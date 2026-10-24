import type { Role, Side } from "./types";

/**
 * Piece sets. Every set except "chessmess" is a folder of 12 SVGs under
 * `public/pieces/<id>/` (wK.svg … bP.svg) taken unmodified from Lichess;
 * credits and licenses are in `public/pieces/LICENSES.md`. Only sets whose
 * licenses allow commercial use are shipped.
 */
export const PIECE_SET_IDS = [
  "cburnett",
  "merida",
  "mpchess",
  "chessnut",
  "papercut",
  "spatial",
  "celtic",
  "fantasy",
  "totoy",
  "rhosgfx",
  "kiwen-suwi",
  "chessmess",
] as const;

export type PieceSetId = (typeof PIECE_SET_IDS)[number];

export interface PieceSetInfo {
  id: PieceSetId;
  name: string;
  line: string;
  author: string;
  license: string;
  licenseUrl?: string;
}

export const DEFAULT_PIECE_SET: PieceSetId = "cburnett";

export const PIECE_SETS: PieceSetInfo[] = [
  {
    id: "cburnett",
    name: "Classic",
    line: "The tournament standard. Crisp and instantly readable.",
    author: "Colin M.L. Burnett",
    license: "GPLv2+",
    licenseUrl: "https://www.gnu.org/licenses/gpl-2.0.txt",
  },
  {
    id: "merida",
    name: "Merida",
    line: "Book-diagram elegance with fine inner lines.",
    author: "Armando Hernandez Marroquin",
    license: "GPLv2+",
    licenseUrl: "https://www.gnu.org/licenses/gpl-2.0.txt",
  },
  {
    id: "mpchess",
    name: "Modern",
    line: "Bold, compact silhouettes. Great on small screens.",
    author: "Maxime Chupin",
    license: "GPLv3+",
    licenseUrl: "https://www.gnu.org/licenses/gpl-3.0.txt",
  },
  {
    id: "chessnut",
    name: "Chessnut",
    line: "Rounded and friendly with a soft gloss.",
    author: "Alexis Luengas",
    license: "Apache 2.0",
    licenseUrl: "https://github.com/LexLuengas/chessnut-pieces/blob/master/LICENSE.txt",
  },
  {
    id: "papercut",
    name: "Papercut",
    line: "Layered paper shapes with gentle shading.",
    author: "Nikolay Anzarov",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "spatial",
    name: "Spatial",
    line: "Sculpted, three-dimensional shading.",
    author: "Maurizio Monge",
    license: "MIT",
    licenseUrl: "https://github.com/maurimo/chess-art/blob/main/LICENSE",
  },
  {
    id: "celtic",
    name: "Celtic",
    line: "Pewter-toned figures with a carved feel.",
    author: "Maurizio Monge",
    license: "MIT",
    licenseUrl: "https://github.com/maurimo/chess-art/blob/main/LICENSE",
  },
  {
    id: "fantasy",
    name: "Fantasy",
    line: "Ornate castles, crowns and staffs.",
    author: "Maurizio Monge",
    license: "MIT",
    licenseUrl: "https://github.com/maurimo/chess-art/blob/main/LICENSE",
  },
  {
    id: "totoy",
    name: "Totoy",
    line: "Clean geometric figures with stacked bases.",
    author: "Kosal Sen",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "rhosgfx",
    name: "Terracotta",
    line: "Warm cream and clay, like painted wood.",
    author: "RhosGFX",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    id: "kiwen-suwi",
    name: "Kiwen",
    line: "Playful minimal glyphs.",
    author: "neverRare",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "chessmess",
    name: "ChessMess",
    line: "Our original flat set, drawn in code.",
    author: "ChessMess",
    license: "Part of this app",
  },
];

export function pieceSetById(id: string | undefined): PieceSetInfo {
  return PIECE_SETS.find((p) => p.id === id) ?? PIECE_SETS[0]!;
}

const ROLE_CHAR: Record<Role, string> = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: "P",
};

/** URL of one piece image, e.g. /pieces/cburnett/wN.svg. */
export function pieceUrl(set: PieceSetId, color: Side, role: Role): string {
  return `/pieces/${set}/${color === "white" ? "w" : "b"}${ROLE_CHAR[role]}.svg`;
}

/** Short code used in data attributes and tests, e.g. "wN". */
export function pieceCode(color: Side, role: Role): string {
  return `${color === "white" ? "w" : "b"}${ROLE_CHAR[role]}`;
}
