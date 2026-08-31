import type { SquareName } from "@/lib/chess/types";

export interface Puzzle {
  id: string;
  title: string;
  theme: string;
  rating: number;
  fen: string;
  goal: "mate" | "exact";
  expect: { from: SquareName; to: SquareName }[];
  hint: string;
}

/** Positions verified for a single correct solution. */
export const PUZZLES: Puzzle[] = [
  {
    id: "back-rank",
    title: "Back rank mate",
    theme: "Checkmate",
    rating: 600,
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    goal: "mate",
    expect: [{ from: "e1", to: "e8" }],
    hint: "The black king has no escape on the back rank.",
  },
  {
    id: "queen-mate",
    title: "Queen mate",
    theme: "Checkmate",
    rating: 650,
    fen: "6k1/5ppp/8/8/8/8/5PPP/6Q1 w - - 0 1",
    goal: "mate",
    expect: [{ from: "g1", to: "g7" }],
    hint: "Deliver mate on the g-file.",
  },
  {
    id: "rook-lift",
    title: "Rook lift mate",
    theme: "Checkmate",
    rating: 750,
    fen: "6k1/5Rpp/8/8/8/8/5PPP/6K1 w - - 0 1",
    goal: "mate",
    expect: [{ from: "f7", to: "f8" }],
    hint: "Slide the rook to the eighth rank.",
  },
  {
    id: "scholar",
    title: "Scholar's pattern",
    theme: "Checkmate",
    rating: 700,
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
    goal: "mate",
    expect: [{ from: "h5", to: "f7" }],
    hint: "A bishop on c4 and queen on h5 aim at f7.",
  },
  {
    id: "opposition",
    title: "King opposition",
    theme: "Endgame",
    rating: 800,
    fen: "8/8/8/8/8/4K3/8/4P3 w - - 0 1",
    goal: "exact",
    expect: [{ from: "e3", to: "e4" }],
    hint: "Seize the opposition before the pawn advances.",
  },
];

export function puzzleById(id: string) {
  return PUZZLES.find((p) => p.id === id);
}

export const DAILY_PUZZLE = PUZZLES[new Date().getDate() % PUZZLES.length]!;
