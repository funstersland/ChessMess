import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { riskFromMetrics } from "@/lib/fairplay/score";
import type { AccountStatus, CaseStatus, ScanMetrics, ScanReport, Verdict } from "@/lib/fairplay/types";

const engineSummary = z.object({
  id: z.enum(["stockfish", "court", "sentinel"]),
  name: z.string(),
  ready: z.boolean(),
  top1: z.number(),
  top3: z.number(),
  acpl: z.number(),
  error: z.string().optional(),
});

const metricsSchema = z.object({
  plyCount: z.number(),
  considered: z.number(),
  stockfish: engineSummary,
  court: engineSummary,
  sentinel: engineSummary,
  consensus: z.number(),
  accuracy: z.number(),
  expectedTop1: z.number(),
  streak: z.number().optional(),
});

type ScanRow = {
  id: string;
  game_id: string | null;
  user_id: string;
  display_name: string;
  opponent: string;
  color: string;
  variant: string;
  source: string;
  pgn: string;
  fen_start: string;
  ply_count: number;
  considered: number;
  stockfish_top1: number | null;
  stockfish_top3: number | null;
  stockfish_acpl: number | null;
  court_top1: number | null;
  court_top3: number | null;
  court_acpl: number | null;
  sentinel_top1: number | null;
  sentinel_top3: number | null;
  sentinel_acpl: number | null;
  consensus: number | null;
  accuracy: number | null;
  risk_score: number;
  verdict: string;
  engines_used: unknown;
  report: unknown;
  created_at: string;
  reporter_id?: string | null;
  kind?: string | null;
  subject_user_id?: string | null;
};

type CaseRow = {
  id: string;
  scan_id: string;
  user_id: string;
  display_name: string;
  opponent: string;
  risk_score: number;
  verdict: string;
  status: string;
  admin_id: string | null;
  admin_note: string | null;
  decided_at: string | null;
  created_at: string;
  reporter_id?: string | null;
  kind?: string | null;
};

function slugName(name: string) {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || "unknown";
}

function isNamedSubject(userId: string) {
  return userId.startsWith("named:");
}

async function ensureProfile(userId: string, name: string) {
  const sql = await getSql();
  await sql`insert into profiles (user_id, display_name) values (${userId}, ${name}) on conflict (user_id) do nothing`;
  return sql;
}

async function isAdmin(userId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ is_admin: boolean }>`select is_admin from profiles where user_id = ${userId}`;
  return Boolean(rows[0]?.is_admin);
}

async function adminExists(): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from profiles where is_admin = true`;
  return (rows[0]?.n ?? 0) > 0;
}

export const getFairPlayMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ensureProfile(context.userId, "Player");
    const me = await sql<{
      display_name: string;
      is_admin: boolean;
      account_status: string;
      fair_play_score: number | null;
      suspend_reason: string | null;
    }>`select display_name, is_admin, account_status, fair_play_score, suspend_reason from profiles where user_id = ${context.userId}`;
    const row = me[0]!;
    const scans = await sql<{ risk_score: number; verdict: string }>`
      select risk_score, verdict from fair_play_scans
      where user_id = ${context.userId} and source <> 'sample' and coalesce(kind, 'auto') = 'auto'
      order by created_at desc limit 8`;
    const pending = await sql<{ n: number }>`
      select count(*)::int as n from fair_play_cases
      where user_id = ${context.userId} and status = 'pending'`;
    const hasAdmin = await adminExists();
    const maxRisk = scans.reduce((a, s) => Math.max(a, s.risk_score), 0);
    const score =
      row.account_status === "suspended"
        ? 0
        : scans.length
          ? Math.max(0, 100 - maxRisk)
          : row.fair_play_score;
    return {
      displayName: row.display_name,
      isAdmin: row.is_admin,
      hasAdmin,
      canClaimAdmin: !row.is_admin && !hasAdmin,
      status: (row.account_status as AccountStatus) || "ok",
      score: score ?? null,
      suspendReason: row.suspend_reason,
      pendingCases: pending[0]?.n ?? 0,
      recent: scans,
    };
  });

export const claimAdminDesk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ensureProfile(context.userId, "Player");
    if (await adminExists()) {
      throw new Error("A steward already sits at this desk.");
    }
    await sql`update profiles set is_admin = true, updated_at = now() where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const submitFairPlayScan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().max(64),
      gameId: z.string().max(64).optional(),
      opponent: z.string().max(80),
      color: z.enum(["white", "black"]),
      variant: z.string().max(32),
      source: z.enum(["live", "history", "sample", "pgn", "report"]),
      pgn: z.string().max(20000),
      fenStart: z.string().max(180),
      rating: z.number(),
      metrics: metricsSchema,
      report: z.any(),
      kind: z.enum(["auto", "report"]).optional(),
      subjectUserId: z.string().max(80).optional(),
      subjectName: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await ensureProfile(context.userId, "Player");
    const me = await sql<{ display_name: string; account_status: string }>`
      select display_name, account_status from profiles where user_id = ${context.userId}`;
    const reporterName = me[0]?.display_name ?? "Player";
    const kind = data.kind ?? (data.source === "report" ? "report" : "auto");
    if (kind === "report" && data.subjectUserId && data.subjectUserId === context.userId) {
      throw new Error("You cannot report yourself.");
    }

    const accusedId =
      kind === "report"
        ? data.subjectUserId && data.subjectUserId.length > 0
          ? data.subjectUserId
          : `named:${slugName(data.subjectName || data.opponent || "unknown")}`
        : context.userId;
    const accusedName =
      kind === "report" ? data.subjectName || data.opponent || "Opponent" : reporterName;

    const metrics: ScanMetrics = {
      ...data.metrics,
      streak: data.metrics.streak ?? 0,
    };
    const { risk, verdict } = riskFromMetrics(metrics, data.rating);
    const m = metrics;
    const engines = [
      m.stockfish.ready ? "stockfish" : null,
      m.court.ready ? "court" : null,
      m.sentinel.ready ? "sentinel" : null,
    ].filter(Boolean);

    await sql`insert into fair_play_scans (
      id, game_id, user_id, display_name, opponent, color, variant, source, pgn, fen_start,
      ply_count, considered, stockfish_top1, stockfish_top3, stockfish_acpl,
      court_top1, court_top3, court_acpl, sentinel_top1, sentinel_top3, sentinel_acpl,
      consensus, accuracy, risk_score, verdict, engines_used, report,
      reporter_id, kind, subject_user_id
    ) values (
      ${data.id}, ${data.gameId ?? null}, ${accusedId}, ${accusedName}, ${data.opponent},
      ${data.color}, ${data.variant}, ${data.source}, ${data.pgn}, ${data.fenStart},
      ${m.plyCount}, ${m.considered}, ${m.stockfish.top1}, ${m.stockfish.top3}, ${m.stockfish.acpl},
      ${m.court.top1}, ${m.court.top3}, ${m.court.acpl}, ${m.sentinel.top1}, ${m.sentinel.top3}, ${m.sentinel.acpl},
      ${m.consensus}, ${m.accuracy}, ${risk}, ${verdict}, ${JSON.stringify(engines)}::jsonb,
      ${JSON.stringify(data.report)}::jsonb,
      ${context.userId}, ${kind}, ${data.subjectUserId ?? null}
    ) on conflict (id) do nothing`;

    const createCase =
      data.source !== "sample" && (verdict === "flag" || verdict === "severe" || kind === "report");
    let caseId: string | null = null;
    if (createCase) {
      const existing = await sql<{ id: string }>`
        select id from fair_play_cases
        where user_id = ${accusedId} and scan_id = ${data.id} limit 1`;
      if (!existing[0]) {
        caseId = `${data.id}-case`;
        await sql`insert into fair_play_cases (
          id, scan_id, user_id, display_name, opponent, risk_score, verdict, status, reporter_id, kind
        ) values (
          ${caseId}, ${data.id}, ${accusedId}, ${accusedName}, ${data.opponent}, ${risk}, ${verdict}, 'pending',
          ${context.userId}, ${kind}
        ) on conflict (id) do nothing`;
      } else {
        caseId = existing[0].id;
      }
      if (!isNamedSubject(accusedId)) {
        await sql`insert into profiles (user_id, display_name) values (${accusedId}, ${accusedName}) on conflict (user_id) do nothing`;
        const acc = await sql<{ account_status: string }>`
          select account_status from profiles where user_id = ${accusedId}`;
        if (acc[0]?.account_status !== "suspended") {
          await sql`update profiles set
            account_status = 'flagged',
            flagged_at = now(),
            fair_play_score = ${Math.max(0, 100 - risk)},
            updated_at = now()
            where user_id = ${accusedId}`;
        }
      }
    } else if (data.source !== "sample" && kind === "auto") {
      await sql`update profiles set
        fair_play_score = ${Math.max(0, 100 - risk)},
        updated_at = now()
        where user_id = ${accusedId} and account_status = 'ok'`;
    }

    return { ok: true as const, risk, verdict, caseId, kind };
  });

export const listMyScans = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<ScanRow>`
      select id, game_id, user_id, display_name, opponent, color, variant, source, pgn, fen_start,
        ply_count, considered, stockfish_top1, stockfish_top3, stockfish_acpl,
        court_top1, court_top3, court_acpl, sentinel_top1, sentinel_top3, sentinel_acpl,
        consensus, accuracy, risk_score, verdict, engines_used, report,
        created_at::text as created_at, reporter_id, kind, subject_user_id
      from fair_play_scans
      where user_id = ${context.userId} or reporter_id = ${context.userId}
      order by created_at desc
      limit 30`;
    return rows.map(shapeScan);
  });

export const listFairPlayCases = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Admin only");
    const sql = await getSql();
    const cases = await sql<CaseRow>`
      select id, scan_id, user_id, display_name, opponent, risk_score, verdict, status,
        admin_id, admin_note, decided_at::text as decided_at, created_at::text as created_at,
        reporter_id, kind
      from fair_play_cases
      order by case when status = 'pending' then 0 when status = 'watch' then 1 else 2 end,
        created_at desc
      limit 80`;
    if (cases.length === 0) return [];
    const ids = cases.map((c) => c.scan_id);
    const scans = await sql.query<ScanRow>(
      `select id, game_id, user_id, display_name, opponent, color, variant, source, pgn, fen_start,
        ply_count, considered, stockfish_top1, stockfish_top3, stockfish_acpl,
        court_top1, court_top3, court_acpl, sentinel_top1, sentinel_top3, sentinel_acpl,
        consensus, accuracy, risk_score, verdict, engines_used, report,
        created_at::text as created_at, reporter_id, kind, subject_user_id
      from fair_play_scans
      where id = any($1::text[])`,
      [ids],
    );
    const scanMap = new Map(scans.map((s) => [s.id, shapeScan(s)]));
    return cases.map((c) => ({
      ...shapeCase(c),
      scan: scanMap.get(c.scan_id) ?? null,
    }));
  });

export const listFairPlayPlayers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Admin only");
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      display_name: string;
      account_status: string;
      fair_play_score: number | null;
      flagged_at: string | null;
      suspended_at: string | null;
      suspend_reason: string | null;
      rating: number;
      is_admin: boolean;
    }>`
      select user_id, display_name, account_status, fair_play_score,
        flagged_at::text as flagged_at, suspended_at::text as suspended_at,
        suspend_reason, rating, is_admin
      from profiles
      where account_status in ('flagged', 'suspended')
      order by case when account_status = 'suspended' then 0 else 1 end, updated_at desc
      limit 80`;
    return rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      status: r.account_status as AccountStatus,
      score: r.fair_play_score,
      flaggedAt: r.flagged_at,
      suspendedAt: r.suspended_at,
      suspendReason: r.suspend_reason,
      rating: r.rating,
      isAdmin: r.is_admin,
    }));
  });

export const decideFairPlayCase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      caseId: z.string().max(80),
      action: z.enum(["suspend", "dismiss", "watch", "restore"]),
      note: z.string().max(280).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Admin only");
    const sql = await getSql();
    const rows = await sql<CaseRow>`select id, scan_id, user_id, display_name, opponent, risk_score, verdict, status, admin_id, admin_note, decided_at::text as decided_at, created_at::text as created_at, reporter_id, kind from fair_play_cases where id = ${data.caseId}`;
    const row = rows[0];
    if (!row) throw new Error("Case not found");
    const status: CaseStatus =
      data.action === "suspend"
        ? "suspended"
        : data.action === "dismiss"
          ? "dismissed"
          : data.action === "restore"
            ? "restored"
            : "watch";
    await sql`update fair_play_cases set
      status = ${status},
      admin_id = ${context.userId},
      admin_note = ${data.note ?? null},
      decided_at = now()
      where id = ${data.caseId}`;

    if (isNamedSubject(row.user_id)) {
      return { ok: true as const, status };
    }

    if (data.action === "suspend") {
      await sql`update profiles set
        account_status = 'suspended',
        suspended_at = now(),
        suspend_reason = ${data.note || "Steward approved suspension after Stockfish, Court, and Sentinel review."},
        fair_play_score = 0,
        updated_at = now()
        where user_id = ${row.user_id}`;
    } else if (data.action === "dismiss" || data.action === "restore") {
      const other = await sql<{ n: number }>`
        select count(*)::int as n from fair_play_cases
        where user_id = ${row.user_id} and status in ('pending', 'watch', 'suspended') and id <> ${data.caseId}`;
      if ((other[0]?.n ?? 0) === 0) {
        await sql`update profiles set
          account_status = 'ok',
          flagged_at = null,
          suspended_at = null,
          suspend_reason = null,
          updated_at = now()
          where user_id = ${row.user_id}`;
      }
    } else {
      await sql`update profiles set
        account_status = 'flagged',
        flagged_at = coalesce(flagged_at, now()),
        updated_at = now()
        where user_id = ${row.user_id} and account_status = 'ok'`;
    }
    return { ok: true as const, status };
  });

export const restorePlayer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string().max(80), note: z.string().max(280).optional() }))
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Admin only");
    if (isNamedSubject(data.userId)) return { ok: true as const };
    const sql = await getSql();
    await sql`update profiles set
      account_status = 'ok',
      flagged_at = null,
      suspended_at = null,
      suspend_reason = null,
      updated_at = now()
      where user_id = ${data.userId}`;
    await sql`update fair_play_cases set
      status = 'restored',
      admin_id = ${context.userId},
      admin_note = ${data.note ?? "Restored by steward."},
      decided_at = now()
      where user_id = ${data.userId} and status in ('pending', 'watch', 'suspended')`;
    return { ok: true as const };
  });

function shapeScan(r: ScanRow) {
  return {
    id: r.id,
    gameId: r.game_id,
    userId: r.user_id,
    displayName: r.display_name,
    opponent: r.opponent,
    color: r.color,
    variant: r.variant,
    source: r.source,
    pgn: r.pgn,
    fenStart: r.fen_start,
    plyCount: r.ply_count,
    considered: r.considered,
    stockfishTop1: r.stockfish_top1,
    stockfishTop3: r.stockfish_top3,
    stockfishAcpl: r.stockfish_acpl,
    courtTop1: r.court_top1,
    courtTop3: r.court_top3,
    courtAcpl: r.court_acpl,
    sentinelTop1: r.sentinel_top1,
    sentinelTop3: r.sentinel_top3,
    sentinelAcpl: r.sentinel_acpl,
    consensus: r.consensus,
    accuracy: r.accuracy,
    risk: r.risk_score,
    verdict: r.verdict as Verdict,
    enginesUsed: (parseJson(r.engines_used) as string[] | null) ?? [],
    report: (parseJson(r.report) as ScanReport | null) ?? null,
    createdAt: r.created_at,
    reporterId: r.reporter_id ?? null,
    kind: (r.kind as "auto" | "report" | null) ?? "auto",
  };
}

function shapeCase(c: CaseRow) {
  return {
    id: c.id,
    scanId: c.scan_id,
    userId: c.user_id,
    displayName: c.display_name,
    opponent: c.opponent,
    risk: c.risk_score,
    verdict: c.verdict as Verdict,
    status: c.status as CaseStatus,
    adminId: c.admin_id,
    adminNote: c.admin_note,
    decidedAt: c.decided_at,
    createdAt: c.created_at,
    reporterId: c.reporter_id ?? null,
    kind: (c.kind as "auto" | "report" | null) ?? "auto",
  };
}

function parseJson(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
}

export type FairPlayMe = Awaited<ReturnType<typeof getFairPlayMe>>;
export type FairPlayScanRow = ReturnType<typeof shapeScan>;
export type FairPlayCaseRow = ReturnType<typeof shapeCase> & {
  scan: FairPlayScanRow | null;
};
export type FairPlayPlayerRow = Awaited<ReturnType<typeof listFairPlayPlayers>>[number];
