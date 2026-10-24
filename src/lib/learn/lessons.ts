import type { Role, SquareName } from "@/lib/chess/types";

export interface LessonStep {
  title: string;
  body: string;
  fen: string;
  goal: "observe" | "any" | "mate" | "exact";
  expect?: { from: SquareName; to: SquareName }[];
  highlight?: SquareName[];
  coach: string;
  playable?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  chapter: string;
  minutes: number;
  piece?: Role;
  steps: LessonStep[];
}

const std = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const LESSONS: Lesson[] = [
  {
    id: "board",
    title: "The board",
    chapter: "Foundations",
    minutes: 4,
    steps: [
      {
        title: "64 squares",
        body: "The board is 8×8. Files are a–h (left to right from White). Ranks are 1–8 (near White to far). a1 is a dark square at White’s left.",
        fen: std,
        goal: "observe",
        highlight: ["a1", "h1", "a8", "h8"],
        coach: "Find a1. That’s White’s left corner, and it is dark.",
      },
      {
        title: "The centre",
        body: "d4, e4, d5, e5 are the four central squares. Pieces here control more of the board. Opening play fights for this space.",
        fen: std,
        goal: "observe",
        highlight: ["d4", "e4", "d5", "e5"],
        coach: "Whoever owns the centre usually owns the game’s geography.",
      },
    ],
  },
  {
    id: "king",
    title: "The king",
    chapter: "The pieces",
    minutes: 5,
    piece: "king",
    steps: [
      {
        title: "One step",
        body: "The king moves one square in any direction. It cannot step into check. Lose the king and the game is over — checkmate.",
        fen: "7k/8/8/8/4K3/8/8/8 w - - 0 1",
        goal: "any",
        playable: true,
        coach: "Move the king one square. Anywhere legal is a lesson.",
      },
      {
        title: "Mate in one",
        body: "White to play and mate. The black king is trapped on the back rank. Bring the queen down.",
        fen: "6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1",
        goal: "mate",
        expect: [{ from: "e1", to: "e8" }],
        playable: true,
        coach: "Queen to e8 is mate. The king has no flight and no capture.",
      },
    ],
  },
  {
    id: "queen",
    title: "The queen",
    chapter: "The pieces",
    minutes: 5,
    piece: "queen",
    steps: [
      {
        title: "Rook plus bishop",
        body: "The queen combines rook and bishop: any number of squares vertically, horizontally, or diagonally, as long as the path is clear.",
        fen: "7k/8/8/8/4Q3/8/8/K7 w - - 0 1",
        goal: "any",
        playable: true,
        coach: "Slide the queen. Watch how many squares she paints.",
      },
      {
        title: "The queen fork",
        body: "A queen on an open board can attack two targets at once. Here she can check the king and hit the rook in the same move.",
        fen: "r3k3/8/8/8/8/8/8/3Q2K1 w - - 0 1",
        goal: "exact",
        expect: [{ from: "d1", to: "a4" }],
        playable: true,
        coach: "Look for a diagonal check that also lines the queen up with the rook on a8.",
      },
    ],
  },
  {
    id: "rook",
    title: "The rook",
    chapter: "The pieces",
    minutes: 4,
    piece: "rook",
    steps: [
      {
        title: "Ranks and files",
        body: "Rooks travel any number of empty squares along a rank or file. They love open lines and the seventh rank.",
        fen: "7k/8/8/8/8/8/8/R3K3 w - - 0 1",
        goal: "any",
        playable: true,
        coach: "Put the rook on an open file. That’s its natural home.",
      },
      {
        title: "The seventh rank",
        body: "A rook on the seventh rank traps the enemy king and hunts pawns. Two rooks on the seventh usually win.",
        fen: "4k3/8/8/8/8/8/R7/4K3 w - - 0 1",
        goal: "exact",
        expect: [{ from: "a2", to: "a7" }],
        playable: true,
        coach: "Swing the rook to a7. Feel how the king is cut off.",
      },
    ],
  },
  {
    id: "bishop",
    title: "The bishop",
    chapter: "The pieces",
    minutes: 4,
    piece: "bishop",
    steps: [
      {
        title: "One colour forever",
        body: "Bishops stay on the colour they start on. A pair of bishops covers the whole board. Keep the diagonals open.",
        fen: "7k/8/8/8/8/8/8/2B1K3 w - - 0 1",
        goal: "any",
        playable: true,
        coach: "Move the bishop. It starts on a dark square and will never leave the dark squares.",
      },
    ],
  },
  {
    id: "knight",
    title: "The knight",
    chapter: "The pieces",
    minutes: 5,
    piece: "knight",
    steps: [
      {
        title: "The L",
        body: "Knights jump in an L: two squares one way and one perpendicular. They hop over pieces. They change square colour every move.",
        fen: "7k/8/8/8/4N3/8/8/4K3 w - - 0 1",
        goal: "any",
        playable: true,
        coach: "Jump the knight. Notice it always lands on the other colour.",
      },
    ],
  },
  {
    id: "pawn",
    title: "The pawn",
    chapter: "The pieces",
    minutes: 6,
    piece: "pawn",
    steps: [
      {
        title: "Forward only",
        body: "Pawns walk one square forward (two from the start), and capture one square diagonally forward. They never move backwards.",
        fen: "7k/8/8/8/8/8/4P3/4K3 w - - 0 1",
        goal: "any",
        playable: true,
        coach: "Push the pawn. From the second rank it may take a double step.",
      },
      {
        title: "Promotion",
        body: "A pawn that reaches the last rank becomes a queen, rook, bishop, or knight. Almost always a queen.",
        fen: "k7/4P3/8/8/8/8/8/4K3 w - - 0 1",
        goal: "exact",
        expect: [{ from: "e7", to: "e8" }],
        playable: true,
        coach: "Advance to e8 and promote. Feel the change in power.",
      },
    ],
  },
  {
    id: "castling",
    title: "Castling",
    chapter: "Special rules",
    minutes: 5,
    steps: [
      {
        title: "King and rook",
        body: "If the king and rook haven’t moved, the path is empty, and the king is not in or through check, you may castle. King two steps toward the rook; rook hops to the other side.",
        fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
        goal: "exact",
        expect: [
          { from: "e1", to: "g1" },
          { from: "e1", to: "c1" },
        ],
        playable: true,
        coach: "Castle short (king to g1) or long (king to c1).",
      },
    ],
  },
  {
    id: "enpassant",
    title: "En passant",
    chapter: "Special rules",
    minutes: 4,
    steps: [
      {
        title: "The passing pawn",
        body: "If a pawn double-steps beside yours, you may capture it as if it had moved only one square — but only on the very next move.",
        fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
        goal: "exact",
        expect: [{ from: "e5", to: "d6" }],
        playable: true,
        coach: "Capture d6 en passant. The black pawn on d5 disappears.",
      },
    ],
  },
  {
    id: "check",
    title: "Check and mate",
    chapter: "Winning",
    minutes: 6,
    steps: [
      {
        title: "Three answers",
        body: "When checked you must: capture the checker, block the line, or move the king. If none exist, it is checkmate — you lose.",
        fen: "4k3/8/8/8/8/8/8/4QK2 b - - 0 1",
        goal: "observe",
        highlight: ["e1", "e8"],
        coach: "Black is in check from the queen on e1. Nothing can capture or block it, so the black king must step off the e-file.",
      },
      {
        title: "Back-rank mate",
        body: "A king trapped behind its own pawns dies to a rook or queen on the eighth rank. Give yourself luft — a flight square.",
        fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        goal: "mate",
        expect: [{ from: "e1", to: "e8" }],
        playable: true,
        coach: "Rook to e8. Mate on the back rank.",
      },
    ],
  },
  {
    id: "draws",
    title: "Draws",
    chapter: "Winning",
    minutes: 4,
    steps: [
      {
        title: "Stalemate is a draw",
        body: "If a player has no legal move and is not in check, the game is drawn — not a win. Also draws: agreement, threefold repetition, 50 idle moves, insufficient material.",
        fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
        goal: "observe",
        coach: "Careful with the queen. Cornering a king without check is stalemate.",
      },
    ],
  },
  {
    id: "opening",
    title: "Opening principles",
    chapter: "Play",
    minutes: 6,
    steps: [
      {
        title: "Three jobs",
        body: "Control the centre, develop pieces (knights then bishops), and castle. Don’t hunt pawns while your king sits in the middle.",
        fen: std,
        goal: "any",
        playable: true,
        coach: "A good first move is e4 or d4. Claim the centre.",
      },
      {
        title: "Develop a knight",
        body: "After e4, the knight on g1 wants f3 — it eyes the centre and prepares short castling.",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        goal: "exact",
        expect: [{ from: "g1", to: "f3" }, { from: "b1", to: "c3" }],
        playable: true,
        coach: "Knight to f3 is the textbook develop. c3 is also fine.",
      },
    ],
  },
  {
    id: "tactics",
    title: "Tactics: fork, pin, skewer",
    chapter: "Play",
    minutes: 7,
    steps: [
      {
        title: "The fork",
        body: "One piece attacks two at once. Knights live for this. Here the knight can jump to c7, checking the king and hitting the rook.",
        fen: "r3k3/pp6/8/1N6/8/8/8/4K3 w - - 0 1",
        goal: "exact",
        expect: [{ from: "b5", to: "c7" }],
        playable: true,
        coach: "Knight to c7 is check and attacks the rook. After the king moves, the rook falls.",
      },
    ],
  },
  {
    id: "value",
    title: "What pieces are worth",
    chapter: "Play",
    minutes: 5,
    steps: [
      {
        title: "The scale",
        body: "Pawn 1, knight 3, bishop 3, rook 5, queen 9. The king is priceless. Trade a rook for a knight only if you get something real for it.",
        fen: std,
        goal: "observe",
        coach: "A queen is worth more than a rook and a knight. Count before you capture.",
      },
      {
        title: "A fair trade",
        body: "Here your bishop can take the knight on c6. Bishop for knight is 3 for 3, an even trade, and Black's pawns get doubled after the recapture.",
        fen: "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
        goal: "exact",
        expect: [{ from: "b5", to: "c6" }],
        playable: true,
        coach: "Bishop takes c6. Material stays level, and you have damaged Black's pawns.",
      },
    ],
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
