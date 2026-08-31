export const VARIANT_IDS = [
  "standard",
  "chess960",
  "kingofthehill",
  "threecheck",
  "crazyhouse",
  "antichess",
  "atomic",
  "horde",
  "racingkings",
  "fromposition",
] as const;

export type VariantId = (typeof VARIANT_IDS)[number];

export type Side = "white" | "black";
export type Role = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type SquareName = string;
export type BoardStyleId =
  | "wood"
  | "ice"
  | "forest"
  | "ocean"
  | "paper"
  | "royal"
  | "noir"
  | "ivory";

export type WorldThemeId =
  | "royal"
  | "wood"
  | "ice"
  | "noir"
  | "forest"
  | "ocean"
  | "ivory"
  | "paper";

export type BotId =
  | "beginner"
  | "strong"
  | "intermediate"
  | "strong-intermediate"
  | "advanced"
  | "strong-advanced"
  | "expert";

export type TimeControlId =
  | "none"
  | "1+0"
  | "3+2"
  | "5+0"
  | "10+0"
  | "15+10"
  | "30+0"
  | "move-10"
  | "move-30"
  | "move-60";

export type MoveClass =
  | "brilliant"
  | "great"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export type OpponentKind = "bot" | "local" | "online";

export interface PieceOnSquare {
  square: SquareName;
  role: Role;
  color: Side;
  promoted?: boolean;
}

export interface LastMove {
  from?: SquareName;
  to: SquareName;
  color: Side;
}

export interface Pocket {
  white: Partial<Record<Role, number>>;
  black: Partial<Record<Role, number>>;
}

export interface GameSnapshot {
  fen: string;
  turn: Side;
  legal: Record<SquareName, SquareName[]>;
  dropLegal: Partial<Record<Role, SquareName[]>>;
  pieces: PieceOnSquare[];
  pocket?: Pocket;
  checksGiven?: { white: number; black: number };
  inCheck: boolean;
  over: boolean;
  winner?: Side | "draw";
  reason?: string;
  canCastle: boolean;
  fullmoves: number;
}

export interface PlayedMove {
  uci: string;
  san: string;
  fenBefore: string;
  fenAfter: string;
  color: Side;
  captured?: Role;
  classification?: MoveClass;
  cp?: number;
  bestSan?: string;
  cpLoss?: number;
}

export interface BotSpec {
  id: BotId;
  name: string;
  blurb: string;
  /** Ladder rating — also passed to Stockfish as UCI_Elo. */
  rating: number;
  /** Search depth cap. */
  depth: number;
  /** Think time per move (ms). */
  movetimeMs: number;
}

export interface VariantInfo {
  id: VariantId;
  name: string;
  blurb: string;
  hasPockets?: boolean;
  lichess:
    | "standard"
    | "chess960"
    | "antichess"
    | "fromPosition"
    | "kingOfTheHill"
    | "threeCheck"
    | "atomic"
    | "horde"
    | "racingKings"
    | "crazyhouse";
}

export interface AnalyzeItem {
  ply: number;
  san: string;
  uci: string;
  classification: MoveClass;
  cpLoss: number;
  bestSan?: string;
  cp?: number;
}

export interface GameRecord {
  id: string;
  opponent: string;
  opponentRating: number;
  color: Side;
  variant: VariantId;
  timeControl: TimeControlId;
  result: "win" | "draw" | "loss";
  rated: boolean;
  ratingBefore: number;
  ratingAfter: number;
  pgn: string;
  fenStart: string;
  analysis?: AnalyzeItem[];
  createdAt: string;
}
