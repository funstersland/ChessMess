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

/**
 * Every position is legal and checked: mate puzzles accept any mate in one,
 * "exact" puzzles have exactly one winning move (the opposition puzzle was
 * verified with a king-and-pawn tablebase and Stockfish).
 */
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
    title: "Queen and king mate",
    theme: "Checkmate",
    rating: 650,
    fen: "7k/8/6K1/8/8/8/8/1Q6 w - - 0 1",
    goal: "mate",
    expect: [{ from: "b1", to: "b8" }],
    hint: "Your king already covers g7 and h7. Bring the queen to the back rank with check.",
  },
  {
    id: "rook-lift",
    title: "Rook lift mate",
    theme: "Checkmate",
    rating: 750,
    fen: "7k/6p1/5p2/8/2B5/R7/5PPP/6K1 w - - 0 1",
    goal: "mate",
    expect: [{ from: "a3", to: "h3" }],
    hint: "The bishop guards g8. Swing the rook along the third rank to the open h-file.",
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
    title: "Take the opposition",
    theme: "Endgame",
    rating: 800,
    fen: "8/8/8/4k3/8/8/3KP3/8 w - - 0 1",
    goal: "exact",
    expect: [{ from: "d2", to: "e3" }],
    hint: "Step in front of your pawn so the kings face each other with one square between. Only one move wins.",
  },
];

export function puzzleById(id: string) {
  return PUZZLES.find((p) => p.id === id);
}

/** Today's puzzle; keyed on the UTC day so server and browser agree. */
export function dailyPuzzle(now: number = Date.now()): Puzzle {
  const day = Math.floor(now / 86_400_000);
  return PUZZLES[day % PUZZLES.length]!;
}

/** Puzzle after `id`, wrapping around. */
export function nextPuzzle(id: string): Puzzle {
  const i = PUZZLES.findIndex((p) => p.id === id);
  return PUZZLES[(i + 1) % PUZZLES.length]!;
}
