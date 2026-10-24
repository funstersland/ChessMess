import type { AnalyzeItem, BotId, TimeControlId } from "@/lib/chess/types";
import { VARIANT_IDS } from "@/lib/chess/types";
import { BOTS, TIME_CONTROLS, botById } from "@/lib/chess/variants";
import { nextRating } from "@/lib/chess/rating";
import { checkGameRecord } from "@/lib/chess/game-check";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type ProfileRow = {
  user_id: string;
  display_name: string;
  bio: string;
  rating: number;
  wins: number;
  draws: number;
  losses: number;
  peak_rating: number;
  coach_voice: string;
  is_admin?: boolean;
  account_status?: string;
  fair_play_score?: number | null;
};

async function ensure(userId: string, name: string): Promise<ProfileRow> {
  const sql = await getSql();
  const rows = await sql<ProfileRow>`select * from profiles where user_id = ${userId}`;
  if (rows[0]) return rows[0];
  await sql`insert into profiles (user_id, display_name) values (${userId}, ${name}) on conflict (user_id) do nothing`;
  const again = await sql<ProfileRow>`select * from profiles where user_id = ${userId}`;
  return again[0]!;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return ensure(context.userId, "Player");
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      displayName: z.string().min(1).max(40),
      bio: z.string().max(280),
      coachVoice: z.enum(["male", "female"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensure(context.userId, data.displayName);
    await sql`update profiles set display_name = ${data.displayName}, bio = ${data.bio}, coach_voice = ${data.coachVoice}, updated_at = now() where user_id = ${context.userId}`;
    const rows = await sql<ProfileRow>`select * from profiles where user_id = ${context.userId}`;
    return rows[0]!;
  });

const BOT_IDS = BOTS.map((b) => b.id) as [BotId, ...BotId[]];
const TIME_IDS = TIME_CONTROLS.map((t) => t.id) as [TimeControlId, ...TimeControlId[]];

const analysisItem = z.object({
  ply: z.number().int().min(0).max(2000),
  san: z.string().max(16),
  uci: z.string().max(8),
  classification: z.enum(["brilliant", "great", "good", "inaccuracy", "mistake", "blunder"]),
  cpLoss: z.number().min(0).max(100000),
  bestSan: z.string().max(16).optional(),
  cp: z.number().min(-100000).max(100000).optional(),
});

/**
 * Record a finished game. The server — not the browser — decides whether it
 * is rated and what the new rating is: it replays the moves to check the
 * claimed result, reads the current rating from the profile, and applies the
 * change exactly once per game id. Suspended players' games are kept but
 * never rated.
 */
export const applyGameResult = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().min(8).max(64),
      opponentKind: z.enum(["bot", "coach", "local", "online"]),
      botId: z.enum(BOT_IDS).optional(),
      opponent: z.string().max(80),
      color: z.enum(["white", "black"]),
      variant: z.enum(VARIANT_IDS),
      timeControl: z.enum(TIME_IDS),
      result: z.enum(["win", "draw", "loss"]),
      reason: z.string().max(40),
      pgn: z.string().max(40_000),
      fenStart: z.string().max(120),
      ucis: z.array(z.string().max(8)).max(1500),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await ensure(context.userId, "Player");
    const bot = data.opponentKind === "bot" && data.botId ? botById(data.botId) : null;
    const suspended = profile.account_status === "suspended";

    let rated = Boolean(bot) && !suspended;
    if (rated) {
      const check = checkGameRecord({
        variant: data.variant,
        fenStart: data.fenStart,
        ucis: data.ucis,
        color: data.color,
        result: data.result,
        reason: data.reason,
        timeControl: data.timeControl,
      });
      if (!check.ok) throw new Error(`Game not rated: ${check.error}`);
    }

    const before = profile.rating;
    let after = before;
    if (rated && bot) {
      const score = data.result === "win" ? 1 : data.result === "draw" ? 0.5 : 0;
      const games = profile.wins + profile.draws + profile.losses;
      after = nextRating(before, bot.rating, score, games).next;
    }

    const opponent = bot ? bot.name : data.opponent;
    const inserted = await sql<{ id: string }>`
      insert into games (id, user_id, opponent, opponent_rating, color, variant, time_control, result, rated, rating_before, rating_after, pgn, fen_start, analysis, opponent_kind, ucis)
      values (${data.id}, ${context.userId}, ${opponent}, ${bot?.rating ?? 1200}, ${data.color}, ${data.variant}, ${data.timeControl}, ${data.result}, ${rated}, ${before}, ${after}, ${data.pgn}, ${data.fenStart}, ${null}, ${data.opponentKind}, ${JSON.stringify(data.ucis)}::jsonb)
      on conflict (id) do nothing
      returning id`;

    if (!inserted[0]) {
      // Already recorded (a retry): report what was stored, change nothing.
      const prior = await sql<{ rated: boolean; rating_before: number; rating_after: number }>`
        select rated, rating_before, rating_after from games where id = ${data.id} and user_id = ${context.userId}`;
      if (!prior[0]) throw new Error("Game id already in use.");
      rated = prior[0].rated;
      const fresh = await ensure(context.userId, "Player");
      return {
        ok: true as const,
        rated,
        ratingBefore: prior[0].rating_before,
        ratingAfter: prior[0].rating_after,
        delta: prior[0].rating_after - prior[0].rating_before,
        profile: { rating: fresh.rating, wins: fresh.wins, draws: fresh.draws, losses: fresh.losses },
      };
    }

    if (rated) {
      const w = data.result === "win" ? 1 : 0;
      const d = data.result === "draw" ? 1 : 0;
      const l = data.result === "loss" ? 1 : 0;
      await sql`update profiles set
        rating = ${after},
        peak_rating = greatest(peak_rating, ${after}),
        wins = wins + ${w},
        draws = draws + ${d},
        losses = losses + ${l},
        updated_at = now()
        where user_id = ${context.userId}`;
    }
    const fresh = await ensure(context.userId, "Player");
    return {
      ok: true as const,
      rated,
      ratingBefore: before,
      ratingAfter: after,
      delta: after - before,
      profile: { rating: fresh.rating, wins: fresh.wins, draws: fresh.draws, losses: fresh.losses },
    };
  });

/** Attach the post-game review to a game you already recorded. */
export const saveGameAnalysis = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().min(8).max(64),
      analysis: z.array(analysisItem).max(1500),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`update games set analysis = ${JSON.stringify(data.analysis)}::jsonb
      where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const listMyGames = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      opponent: string;
      opponent_rating: number;
      color: string;
      variant: string;
      time_control: string;
      result: string;
      rated: boolean;
      rating_before: number;
      rating_after: number;
      pgn: string;
      fen_start: string;
      analysis: AnalyzeItem[] | null;
      created_at: string;
    }>`select id, opponent, opponent_rating, color, variant, time_control, result, rated, rating_before, rating_after, pgn, fen_start, analysis, created_at::text as created_at from games where user_id = ${context.userId} order by created_at desc limit 50`;
    return rows.map((r) => ({
      ...r,
      analysis: Array.isArray(r.analysis) ? r.analysis : null,
    }));
  });

export const getMyGame = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().max(80) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      opponent: string;
      opponent_rating: number;
      color: string;
      variant: string;
      time_control: string;
      result: string;
      rated: boolean;
      rating_before: number;
      rating_after: number;
      pgn: string;
      fen_start: string;
      analysis: AnalyzeItem[] | null;
      ucis: string[] | null;
      created_at: string;
    }>`select id, opponent, opponent_rating, color, variant, time_control, result, rated, rating_before, rating_after, pgn, fen_start, analysis, ucis, created_at::text as created_at from games where id = ${data.id} and user_id = ${context.userId} limit 1`;
    const r = rows[0];
    if (!r) throw new Error("Game not found");
    return {
      ...r,
      analysis: Array.isArray(r.analysis) ? r.analysis : null,
      ucis: Array.isArray(r.ucis) ? r.ucis : [],
    };
  });
