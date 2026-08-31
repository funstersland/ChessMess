import { generateMoves, loadPosition } from "@/lib/chess/engine";
import type { Side, VariantId } from "@/lib/chess/types";
import { ENGINE_META, type EngineHit, type EngineId, type EnginePv, type MoveProbe, type ScanProgress, type ScanReport } from "./types";
import { parseGamePgn, replayUcis, type ParsedMove } from "./pgn";
import { accuracyFromAcpl, expectedTop1, longestTop1Streak, riskFromMetrics, summarizeEngine } from "./score";
import { getStockfish } from "./stockfish";

const OPENING_PLIES = 6;

export interface ScanInput {
  pgn?: string;
  fenStart?: string;
  ucis?: string[];
  variant?: VariantId;
  color: Side;
  rating: number;
  opponent?: string;
}

function matchRank(played: string, top: EnginePv[]): 0 | 1 | 2 | 3 {
  const i = top.findIndex((p) => p.uci === played);
  if (i === 0) return 1;
  if (i === 1) return 2;
  if (i === 2) return 3;
  return 0;
}

function cplAgainst(played: string, top: EnginePv[]): number {
  if (top.length === 0) return 0;
  const best = top[0]!.cp;
  const hit = top.find((p) => p.uci === played);
  if (!hit) {
    const gap = best - (top[top.length - 1]!.cp - 80);
    return Math.max(0, Math.round(gap));
  }
  return Math.max(0, Math.round(best - hit.cp));
}

function skipReason(move: ParsedMove, variant: VariantId): string | undefined {
  if (move.ply < OPENING_PLIES) return "opening";
  const pos = loadPosition(variant, move.fenBefore);
  const legal = generateMoves(pos);
  if (legal.length <= 1) return "forced";
  return undefined;
}

const EMPTY_SUMMARY = {
  id: "court" as const,
  name: "—",
  ready: false,
  top1: 0,
  top3: 0,
  acpl: 0,
  error: "unused",
};

export async function scanGame(
  input: ScanInput,
  onProgress?: (p: ScanProgress) => void,
): Promise<ScanReport> {
  onProgress?.({ phase: "wake", message: "Starting Stockfish…" });
  const parsed = input.pgn
    ? parseGamePgn(input.pgn)
    : replayUcis(input.fenStart ?? "", input.ucis ?? [], input.variant ?? "standard");
  const variant = input.variant ?? parsed.variant;
  const color = input.color;
  const opponent =
    input.opponent ??
    (color === "white" ? parsed.black : parsed.white);

  let stockfishReady = false;
  try {
    stockfishReady = await getStockfish().ensure();
  } catch {
    stockfishReady = false;
  }
  onProgress?.({
    phase: "wake",
    engine: "stockfish",
    message: stockfishReady ? "Stockfish is ready." : "Stockfish unavailable.",
  });

  const sideMoves = parsed.moves.filter((m) => m.color === color);
  const probes: MoveProbe[] = [];
  let i = 0;
  for (const mv of sideMoves) {
    i += 1;
    onProgress?.({
      phase: "scan",
      ply: i,
      total: sideMoves.length,
      message: `Ply ${mv.ply + 1} · ${mv.san} · Stockfish`,
    });
    const skip = skipReason(mv, variant);
    const engines: EngineHit[] = [];

    if (!stockfishReady) {
      engines.push({
        id: "stockfish",
        name: ENGINE_META.stockfish.name,
        top: [],
        match: 0,
        cpl: 0,
        error: "offline",
      });
    } else {
      try {
        const top = await getStockfish().analyze(mv.fenBefore, variant, 10, 360);
        engines.push({
          id: "stockfish",
          name: ENGINE_META.stockfish.name,
          top,
          match: matchRank(mv.uci, top),
          cpl: cplAgainst(mv.uci, top),
        });
      } catch (err) {
        engines.push({
          id: "stockfish",
          name: ENGINE_META.stockfish.name,
          top: [],
          match: 0,
          cpl: 0,
          error: err instanceof Error ? err.message : "error",
        });
      }
    }

    probes.push({
      ply: mv.ply,
      san: mv.san,
      uci: mv.uci,
      color: mv.color,
      fen: mv.fenBefore,
      considered: !skip,
      skipReason: skip,
      engines,
    });
  }

  onProgress?.({ phase: "score", message: "Scoring engine agreement…" });

  const considered = probes.filter((p) => p.considered);
  const pack = (id: EngineId) => {
    const hits = considered.map((p) => p.engines.find((e) => e.id === id));
    const ready = hits.some((h) => h && !h.error && h.top.length > 0);
    return summarizeEngine(
      id,
      ENGINE_META[id].name,
      considered.map((p) => p.engines.find((e) => e.id === id)?.match ?? 0),
      considered.map((p) => p.engines.find((e) => e.id === id)?.cpl ?? 0),
      ready,
      hits.find((h) => h?.error)?.error,
    );
  };

  const stockfish = pack("stockfish");
  const court = { ...EMPTY_SUMMARY, id: "court" as const, name: ENGINE_META.court.name };
  const sentinel = { ...EMPTY_SUMMARY, id: "sentinel" as const, name: ENGINE_META.sentinel.name };

  const sfMatches = considered.map((p) => p.engines.find((e) => e.id === "stockfish")?.match ?? 0);
  const metrics = {
    plyCount: parsed.moves.length,
    considered: considered.length,
    stockfish,
    court,
    sentinel,
    consensus: stockfish.top1,
    accuracy: accuracyFromAcpl(stockfish.acpl),
    expectedTop1: expectedTop1(input.rating),
    streak: longestTop1Streak(sfMatches),
  };
  const { risk, verdict } = riskFromMetrics(metrics, input.rating);
  const enginesUsed: EngineId[] = stockfish.ready ? ["stockfish"] : [];

  return {
    color,
    variant,
    fenStart: parsed.fenStart,
    pgn: input.pgn ?? "",
    opponent,
    rating: input.rating,
    moves: probes,
    metrics,
    risk,
    verdict,
    enginesUsed,
  };
}
