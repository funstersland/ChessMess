import type { BoardStyleId, WorldThemeId } from "@/lib/chess/types";

export interface WorldTheme {
  id: WorldThemeId;
  name: string;
  line: string;
  defaultBoard: BoardStyleId;
}

export interface BoardStyleInfo {
  id: BoardStyleId;
  name: string;
  line: string;
  world?: WorldThemeId;
}

/** Flat classic boards — no textures or capture effects, maximum clarity. */
export const CLASSIC_BOARD_STYLES: BoardStyleInfo[] = [
  { id: "brown", name: "Brown", line: "The classic tan and walnut of club boards." },
  { id: "green", name: "Tournament", line: "Cream and green, like a vinyl roll-up board." },
  { id: "blue", name: "Blue", line: "Cool grey-blue. Easy on the eyes for long sessions." },
  { id: "olive", name: "Olive", line: "Pale stone and soft olive. Low contrast, calm." },
  { id: "slate", name: "Slate", line: "Neutral greys that let colourful pieces pop." },
  { id: "lavender", name: "Lavender", line: "Soft lilac and violet." },
  { id: "rose", name: "Rose", line: "Blush and dusty rose." },
];

/** Boards tied to playable worlds — shown in Settings → Board. */
export const WORLD_BOARD_STYLES: BoardStyleInfo[] = [
  {
    id: "wood",
    name: "Wooden",
    line: "Maple and walnut grain. Warm classic table.",
    world: "wood",
  },
  {
    id: "ice",
    name: "Ice",
    line: "Frosted crystal and deep frozen glass.",
    world: "ice",
  },
  {
    id: "forest",
    name: "Forest",
    line: "Green marble veining. Moss and stone.",
    world: "forest",
  },
  {
    id: "ocean",
    name: "Ocean",
    line: "Wet slate tiles. Rain-slick sheen.",
    world: "ocean",
  },
  {
    id: "paper",
    name: "Paper",
    line: "Foxed parchment grid. Faded manuscript.",
    world: "paper",
  },
];

/** Textured boards from the worlds — wood, ice, forest, ocean, paper, ivory, royal, noir. */
export const THEMED_BOARD_STYLES: BoardStyleInfo[] = [
  ...WORLD_BOARD_STYLES,
  {
    id: "ivory",
    name: "Ivory",
    line: "Polished cream ivory and carved mahogany.",
    world: "ivory",
  },
  {
    id: "royal",
    name: "Royal",
    line: "Ruby red and bright white. Court gloss.",
    world: "royal",
  },
  {
    id: "noir",
    name: "Noir",
    line: "Mother-of-pearl light, black wood grain.",
    world: "noir",
  },
];

/** Every selectable board: flat classics first, then the textured world boards. */
export const BOARD_STYLES: BoardStyleInfo[] = [...CLASSIC_BOARD_STYLES, ...THEMED_BOARD_STYLES];

export const WORLD_THEMES: WorldTheme[] = [
  {
    id: "royal",
    name: "Royal",
    line: "Burgundy halls. The queen’s court.",
    defaultBoard: "royal",
  },
  {
    id: "wood",
    name: "Wood",
    line: "Walnut grain. Warm board, soft knock.",
    defaultBoard: "wood",
  },
  {
    id: "ice",
    name: "Ice",
    line: "A frozen cathedral. Crystal pieces, glass notes.",
    defaultBoard: "ice",
  },
  {
    id: "noir",
    name: "Noir",
    line: "Ink and ivory. Quiet, severe, precise.",
    defaultBoard: "noir",
  },
  {
    id: "forest",
    name: "Forest",
    line: "Moss and old wood. Deep shade.",
    defaultBoard: "forest",
  },
  {
    id: "ocean",
    name: "Ocean",
    line: "Tide-worn stone. Low drones, salt air.",
    defaultBoard: "ocean",
  },
  {
    id: "ivory",
    name: "Ivory",
    line: "Daylight court. Paper, ink, pale wood.",
    defaultBoard: "ivory",
  },
  {
    id: "paper",
    name: "Paper",
    line: "Foxed parchment. Yellowed edges, faded ink.",
    defaultBoard: "paper",
  },
];

const LEGACY_BOARD: Record<string, BoardStyleId> = {
  walnut: "wood",
  glacier: "ice",
  moss: "forest",
  tide: "ocean",
  ember: "wood",
  ink: "noir",
};

export function normalizeBoardStyle(id: string): BoardStyleId {
  return (LEGACY_BOARD[id] ?? id) as BoardStyleId;
}

export function boardById(id: BoardStyleId): BoardStyleInfo | undefined {
  return BOARD_STYLES.find((b) => b.id === id);
}

export function themeById(id: WorldThemeId): WorldTheme {
  return WORLD_THEMES.find((t) => t.id === id) ?? WORLD_THEMES[0];
}
