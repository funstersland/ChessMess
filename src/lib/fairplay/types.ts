import type { Side, VariantId } from "@/lib/chess/types";

export const ENGINE_IDS = ["stockfish", "court", "sentinel"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

export const VERDICTS = ["insufficient", "clean", "watch", "flag", "severe"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const CASE_STATUSES = ["pending", "watch", "suspended", "dismissed", "restored"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const ACCOUNT_STATUSES = ["ok", "flagged", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const SCAN_KINDS = ["auto", "report"] as const;
export type ScanKind = (typeof SCAN_KINDS)[number];

export interface EnginePv {
  uci: string;
  san: string;
  /** Centipawns, side-to-move positive. */
  cp: number;
}

export interface EngineHit {
  id: EngineId;
  name: string;
  top: EnginePv[];
  /** 1 = top move, 2 = 2nd, 3 = 3rd, 0 = miss */
  match: 0 | 1 | 2 | 3;
  cpl: number;
  error?: string;
}

export interface MoveProbe {
  ply: number;
  san: string;
  uci: string;
  color: Side;
  fen: string;
  considered: boolean;
  skipReason?: string;
  engines: EngineHit[];
}

export interface EngineSummary {
  id: EngineId;
  name: string;
  ready: boolean;
  top1: number;
  top3: number;
  acpl: number;
  error?: string;
}

export interface ScanMetrics {
  plyCount: number;
  considered: number;
  stockfish: EngineSummary;
  court: EngineSummary;
  sentinel: EngineSummary;
  consensus: number;
  accuracy: number;
  expectedTop1: number;
  streak?: number;
}

export interface ScanReport {
  color: Side;
  variant: VariantId;
  fenStart: string;
  pgn: string;
  opponent: string;
  rating: number;
  moves: MoveProbe[];
  metrics: ScanMetrics;
  risk: number;
  verdict: Verdict;
  enginesUsed: EngineId[];
}

export interface ScanProgress {
  phase: "wake" | "scan" | "score";
  engine?: EngineId;
  ply?: number;
  total?: number;
  message: string;
}

export const ENGINE_META: Record<
  EngineId,
  { name: string; blurb: string }
> = {
  stockfish: {
    name: "Stockfish",
    blurb: "NNUE engine for bots, coach, hints, and Fair Play scans.",
  },
  court: {
    name: "Court",
    blurb: "Retired — Stockfish only.",
  },
  sentinel: {
    name: "Sentinel",
    blurb: "Retired — Stockfish only.",
  },
};
