import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import type { PeerRow, RtcPollResponse, SignalRow } from "./p2p";

/*
 * Signaling relay for friend games. Guests can play without an account, so
 * requests are anonymous, but each peer id is bound to a secret key that only
 * its own browser knows (stored here as a SHA-256 hash). Without the key you
 * cannot read a peer's inbox, send signals as that peer, or remove it. Rooms
 * hold two players, bodies are size-checked before parsing, and requests are
 * rate limited per IP so six-digit room codes cannot be swept.
 */

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const KEY = z.string().regex(/^[a-f0-9]{32,64}$/);
const signalSchema = z.object({
  op: z.literal("signal"),
  room: ID,
  from: ID,
  key: KEY,
  to: ID,
  kind: z.enum(["offer", "answer", "ice"]),
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 32_768, {
    message: "payload too large",
  }),
});
const leaveSchema = z.object({ op: z.literal("leave"), room: ID, peer: ID, key: KEY });
const postSchema = z.discriminatedUnion("op", [signalSchema, leaveSchema]);

const PEER_TTL_SECONDS = 30;
const SIGNAL_TTL_SECONDS = 60;
/** Chess is one-on-one. */
const ROOM_CAPACITY = 2;
const MAX_BODY_BYTES = 40_000;
/**
 * Requests per IP per minute. One connecting browser polls ~150/min, and a
 * school or office may put many players behind one address.
 */
const RATE_PER_MINUTE = 3000;
/**
 * Distinct rooms one IP may join per 10 minutes — plenty for real players,
 * while sweeping the million six-digit codes would take months.
 */
const ROOMS_PER_WINDOW = 60;

type Bucket = { count: number; windowStart: number; rooms: Map<string, number> };
const rateGlobal = globalThis as typeof globalThis & { __rtcRate__?: Map<string, Bucket> };
const buckets = (rateGlobal.__rtcRate__ ??= new Map());

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local").slice(0, 64);
}

/** Per-instance limiter; good enough to stop sweeping room codes. */
function allow(ip: string, room?: string): "ok" | "rate" | "rooms" {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.windowStart > 60_000) {
    b = { count: 0, windowStart: now, rooms: b?.rooms ?? new Map() };
    buckets.set(ip, b);
  }
  b.count += 1;
  if (b.count > RATE_PER_MINUTE) return "rate";
  if (room) {
    for (const [r, t] of b.rooms) if (now - t > 600_000) b.rooms.delete(r);
    if (!b.rooms.has(room) && b.rooms.size >= ROOMS_PER_WINDOW) return "rooms";
    b.rooms.set(room, now);
  }
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (now - v.windowStart > 120_000) buckets.delete(k);
  }
  return "ok";
}

async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Suspended accounts may not play online. Guests (no session) may. */
async function isSuspended(request: Request, sql: Sql): Promise<boolean> {
  try {
    const { auth } = await import("@/lib/auth/server");
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    if (!userId) return false;
    const rows = await sql.query<{ account_status: string }>(
      `SELECT account_status FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return rows[0]?.account_status === "suspended";
  } catch {
    return false;
  }
}

const globalRef = globalThis as typeof globalThis & {
  __rtcSchemaPromise__?: Promise<void>;
};

function ensureSchema(sql: Sql): Promise<void> {
  globalRef.__rtcSchemaPromise__ ??= (async () => {
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_peers (
         room TEXT NOT NULL,
         peer_id TEXT NOT NULL,
         name TEXT NOT NULL DEFAULT '',
         last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (room, peer_id)
       )`,
    );
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_signals (
         id BIGSERIAL PRIMARY KEY,
         room TEXT NOT NULL,
         to_peer TEXT NOT NULL,
         from_peer TEXT NOT NULL,
         kind TEXT NOT NULL,
         payload JSONB NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_signals_inbox
         ON webrtc_signals (room, to_peer, id)`,
    );
    await sql.query(`ALTER TABLE webrtc_peers ADD COLUMN IF NOT EXISTS key_hash TEXT`);
  })().catch((err) => {
    globalRef.__rtcSchemaPromise__ = undefined;
    throw err;
  });
  return globalRef.__rtcSchemaPromise__;
}

async function roster(sql: Sql, room: string): Promise<PeerRow[]> {
  const rows = await sql.query<{ peer_id: string; name: string }>(
    `SELECT peer_id, name FROM webrtc_peers
     WHERE room = $1 AND last_seen > now() - make_interval(secs => $2)
     ORDER BY peer_id LIMIT 32`,
    [room, PEER_TTL_SECONDS],
  );
  return rows.map((r) => ({ id: r.peer_id, name: r.name }));
}

/**
 * Register or refresh a peer. Returns "forbidden" when the id is held by
 * another key, "full" when the room already has two other live players.
 */
async function touchPeer(
  sql: Sql,
  room: string,
  peer: string,
  name: string,
  keyHash: string,
): Promise<"ok" | "forbidden" | "full"> {
  // An expired registration can be taken over; a live one cannot.
  await sql.query(
    `DELETE FROM webrtc_peers
     WHERE room = $1 AND peer_id = $2 AND last_seen < now() - make_interval(secs => $3)`,
    [room, peer, PEER_TTL_SECONDS],
  );
  const existing = await sql.query<{ key_hash: string | null }>(
    `SELECT key_hash FROM webrtc_peers WHERE room = $1 AND peer_id = $2`,
    [room, peer],
  );
  if (existing[0]) {
    if (existing[0].key_hash !== keyHash) return "forbidden";
    await sql.query(
      `UPDATE webrtc_peers SET last_seen = now(), name = $3 WHERE room = $1 AND peer_id = $2`,
      [room, peer, name],
    );
    return "ok";
  }
  const others = await sql.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM webrtc_peers
     WHERE room = $1 AND peer_id <> $2 AND last_seen > now() - make_interval(secs => $3)`,
    [room, peer, PEER_TTL_SECONDS],
  );
  if ((others[0]?.n ?? 0) >= ROOM_CAPACITY) return "full";
  await sql.query(
    `INSERT INTO webrtc_peers (room, peer_id, name, key_hash, last_seen)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (room, peer_id) DO NOTHING`,
    [room, peer, name, keyHash],
  );
  return "ok";
}

/** True when `peer` is a live member of `room` holding `keyHash`. */
async function ownsPeer(sql: Sql, room: string, peer: string, keyHash: string): Promise<boolean> {
  const rows = await sql.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM webrtc_peers
     WHERE room = $1 AND peer_id = $2 AND key_hash = $3
       AND last_seen > now() - make_interval(secs => $4)`,
    [room, peer, keyHash, PEER_TTL_SECONDS],
  );
  return (rows[0]?.n ?? 0) > 0;
}

async function isLivePeer(sql: Sql, room: string, peer: string): Promise<boolean> {
  const rows = await sql.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM webrtc_peers
     WHERE room = $1 AND peer_id = $2 AND last_seen > now() - make_interval(secs => $3)`,
    [room, peer, PEER_TTL_SECONDS],
  );
  return (rows[0]?.n ?? 0) > 0;
}

async function prune(sql: Sql) {
  await Promise.all([
    sql.query(`DELETE FROM webrtc_signals WHERE created_at < now() - make_interval(secs => $1)`, [
      SIGNAL_TTL_SECONDS,
    ]),
    sql.query(`DELETE FROM webrtc_peers WHERE last_seen < now() - make_interval(secs => $1)`, [
      PEER_TTL_SECONDS,
    ]),
  ]);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function handleGet(request: Request, url: URL): Promise<Response> {
  const parsed = z
    .object({
      room: ID,
      peer: ID,
      key: KEY,
      name: z.string().max(64).default(""),
      since: z.coerce.number().int().min(0).default(0),
    })
    .safeParse({
      room: url.searchParams.get("room"),
      peer: url.searchParams.get("peer"),
      key: request.headers.get("x-rtc-key"),
      name: url.searchParams.get("name") ?? "",
      since: url.searchParams.get("since") ?? 0,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);
  const { room, peer, key, name, since } = parsed.data;

  const limit = allow(clientIp(request), room);
  if (limit !== "ok") return json({ error: limit === "rooms" ? "too many rooms" : "rate limited" }, 429);

  const sql = await getSql();
  await ensureSchema(sql);
  if (since === 0 || Math.random() < 0.02) await prune(sql);
  if (since === 0 && (await isSuspended(request, sql))) {
    return json({ error: "suspended" }, 403);
  }
  const touched = await touchPeer(sql, room, peer, name, await hashKey(key));
  if (touched === "forbidden") return json({ error: "forbidden" }, 403);
  if (touched === "full") return json({ error: "room full" }, 409);
  const rows = await sql.query<{
    id: number;
    from_peer: string;
    kind: SignalRow["kind"];
    payload: unknown;
  }>(
    `SELECT id, from_peer, kind, payload FROM webrtc_signals
     WHERE room = $1 AND to_peer = $2 AND id > $3
     ORDER BY id LIMIT 200`,
    [room, peer, since],
  );
  const body: RtcPollResponse = {
    peers: await roster(sql, room),
    signals: rows.map((r) => ({
      id: r.id,
      from: r.from_peer,
      kind: r.kind,
      payload: r.payload,
    })),
  };
  return json(body);
}

async function handlePost(request: Request): Promise<Response> {
  if (allow(clientIp(request)) !== "ok") return json({ error: "rate limited" }, 429);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const msg = parsed.data;
  const sql = await getSql();
  await ensureSchema(sql);
  const keyHash = await hashKey(msg.key);

  if (msg.op === "signal") {
    if (!(await ownsPeer(sql, msg.room, msg.from, keyHash))) return json({ error: "forbidden" }, 403);
    if (!(await isLivePeer(sql, msg.room, msg.to))) return json({ error: "unknown peer" }, 404);
    await sql.query(
      `INSERT INTO webrtc_signals (room, to_peer, from_peer, kind, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [msg.room, msg.to, msg.from, msg.kind, JSON.stringify(msg.payload)],
    );
  } else {
    await sql.query(`DELETE FROM webrtc_peers WHERE room = $1 AND peer_id = $2 AND key_hash = $3`, [
      msg.room,
      msg.peer,
      keyHash,
    ]);
  }
  return json({ ok: true });
}

export async function handleSignaling(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") return await handleGet(request, new URL(request.url));
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[rtc] signaling error:", error);
    return json({ error: "signaling failed" }, 500);
  }
}
