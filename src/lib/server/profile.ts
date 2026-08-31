import type { AnalyzeItem } from "@/lib/chess/types";
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

export const applyGameResult = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().max(64),
      opponent: z.string().max(80),
      opponentRating: z.number(),
      color: z.enum(["white", "black"]),
      variant: z.string(),
      timeControl: z.string(),
      result: z.enum(["win", "draw", "loss"]),
      rated: z.boolean(),
      ratingBefore: z.number(),
      ratingAfter: z.number(),
      pgn: z.string(),
      fenStart: z.string(),
      analysis: z.array(z.any()).optional(),
      opponentKind: z.enum(["bot", "local", "online"]).optional(),
      ucis: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensure(context.userId, "Player");
    await sql`insert into games (id, user_id, opponent, opponent_rating, color, variant, time_control, result, rated, rating_before, rating_after, pgn, fen_start, analysis, opponent_kind, ucis)
      values (${data.id}, ${context.userId}, ${data.opponent}, ${data.opponentRating}, ${data.color}, ${data.variant}, ${data.timeControl}, ${data.result}, ${data.rated}, ${data.ratingBefore}, ${data.ratingAfter}, ${data.pgn}, ${data.fenStart}, ${JSON.stringify(data.analysis ?? null)}::jsonb, ${data.opponentKind ?? "bot"}, ${JSON.stringify(data.ucis ?? [])}::jsonb)
      on conflict (id) do nothing`;
    if (data.rated) {
      const w = data.result === "win" ? 1 : 0;
      const d = data.result === "draw" ? 1 : 0;
      const l = data.result === "loss" ? 1 : 0;
      await sql`update profiles set
        rating = ${data.ratingAfter},
        peak_rating = greatest(peak_rating, ${data.ratingAfter}),
        wins = wins + ${w},
        draws = draws + ${d},
        losses = losses + ${l},
        updated_at = now()
        where user_id = ${context.userId}`;
    }
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
