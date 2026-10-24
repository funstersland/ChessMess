import type { BotSpec, TimeControlId, VariantId, VariantInfo } from "./types";

export const VARIANTS: VariantInfo[] = [
  {
    id: "standard",
    name: "Standard",
    blurb: "Classical chess. Mate the king.",
    lichess: "standard",
  },
  {
    id: "chess960",
    name: "Chess960",
    blurb: "Fischer random. Back rank shuffled, same rules.",
    lichess: "chess960",
  },
  {
    id: "kingofthehill",
    name: "King of the Hill",
    blurb: "Get your king to d4, e4, d5, or e5.",
    lichess: "kingOfTheHill",
  },
  {
    id: "threecheck",
    name: "Three-Check",
    blurb: "Deliver three checks to win.",
    lichess: "threeCheck",
  },
  {
    id: "crazyhouse",
    name: "Crazyhouse",
    blurb: "Captured pieces drop back as yours.",
    lichess: "crazyhouse",
    hasPockets: true,
  },
  {
    id: "antichess",
    name: "Antichess",
    blurb: "Lose every piece. Captures are forced.",
    lichess: "antichess",
  },
  {
    id: "atomic",
    name: "Atomic",
    blurb: "Captures explode neighbouring pieces.",
    lichess: "atomic",
  },
  {
    id: "horde",
    name: "Horde",
    blurb: "White’s pawn army vs Black’s full set.",
    lichess: "horde",
  },
  {
    id: "racingkings",
    name: "Racing Kings",
    blurb: "First king to the eighth rank wins.",
    lichess: "racingKings",
  },
  {
    id: "fromposition",
    name: "From Position",
    blurb: "Set a custom FEN and play from there.",
    lichess: "fromPosition",
  },
];

/**
 * Bot ladder. Skill/depth/time follow the shape of Lichess's Stockfish levels
 * (skill 3/depth 1 is a casual beginner, skill 18/depth 10 is a strong club
 * player), tuned so each rung is a step up from the last.
 */
export const BOTS: BotSpec[] = [
  {
    id: "beginner",
    name: "Beginner",
    blurb: "Learning the ropes. Misses tactics.",
    rating: 1200,
    skill: 3,
    depth: 1,
    movetimeMs: 80,
  },
  {
    id: "strong",
    name: "Strong",
    blurb: "Sees one-move tactics. Still human.",
    rating: 1350,
    skill: 5,
    depth: 2,
    movetimeMs: 120,
  },
  {
    id: "intermediate",
    name: "Intermediate",
    blurb: "Club-level. Punishes free material.",
    rating: 1500,
    skill: 8,
    depth: 3,
    movetimeMs: 180,
  },
  {
    id: "strong-intermediate",
    name: "Strong Intermediate",
    blurb: "Solid. Knows openings and king safety.",
    rating: 1650,
    skill: 10,
    depth: 4,
    movetimeMs: 220,
  },
  {
    id: "advanced",
    name: "Advanced",
    blurb: "Looks ahead. You need a plan.",
    rating: 1800,
    skill: 12,
    depth: 5,
    movetimeMs: 280,
  },
  {
    id: "strong-advanced",
    name: "Strong Advanced",
    blurb: "Deep search. Mistakes get crushed.",
    rating: 2000,
    skill: 15,
    depth: 7,
    movetimeMs: 380,
  },
  {
    id: "expert",
    name: "Expert",
    blurb: "Our strongest. Bring your theory.",
    rating: 2200,
    skill: 18,
    depth: 10,
    movetimeMs: 600,
  },
];

export const TIME_CONTROLS: {
  id: TimeControlId;
  name: string;
  group: "casual" | "bullet" | "blitz" | "rapid" | "move";
  baseSec: number | null;
  incSec: number;
  perMove: boolean;
}[] = [
  { id: "none", name: "No limit", group: "casual", baseSec: null, incSec: 0, perMove: false },
  { id: "1+0", name: "1+0 Bullet", group: "bullet", baseSec: 60, incSec: 0, perMove: false },
  { id: "3+2", name: "3+2 Blitz", group: "blitz", baseSec: 180, incSec: 2, perMove: false },
  { id: "5+0", name: "5+0 Blitz", group: "blitz", baseSec: 300, incSec: 0, perMove: false },
  { id: "10+0", name: "10+0 Rapid", group: "rapid", baseSec: 600, incSec: 0, perMove: false },
  { id: "15+10", name: "15+10 Rapid", group: "rapid", baseSec: 900, incSec: 10, perMove: false },
  { id: "30+0", name: "30+0 Classical", group: "rapid", baseSec: 1800, incSec: 0, perMove: false },
  { id: "move-10", name: "10s / move", group: "move", baseSec: 10, incSec: 0, perMove: true },
  { id: "move-30", name: "30s / move", group: "move", baseSec: 30, incSec: 0, perMove: true },
  { id: "move-60", name: "60s / move", group: "move", baseSec: 60, incSec: 0, perMove: true },
];

export function variantById(id: VariantId): VariantInfo {
  return VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
}

export function botById(id: string): BotSpec {
  return BOTS.find((b) => b.id === id) ?? BOTS[2];
}

export function timeById(id: TimeControlId) {
  return TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[0];
}
