import type { Position } from "chessops/chess";
import { parseSquare } from "chessops/util";
import type { BoardStyleId, Role, Side, SquareName } from "@/lib/chess/types";
import { themeById } from "@/lib/theme/themes";

/** Boards with themed capture overlays. Ivory keeps the default shake + sound only. */
export const CAPTURE_FX_BOARDS = ["wood", "royal", "ice", "noir", "forest", "ocean", "paper"] as const satisfies readonly BoardStyleId[];
export type CaptureFxBoardId = (typeof CAPTURE_FX_BOARDS)[number];

export function boardHasCaptureFx(board: BoardStyleId): board is CaptureFxBoardId {
  return (CAPTURE_FX_BOARDS as readonly string[]).includes(board);
}

export function activeBoardStyle(
  theme: Parameters<typeof themeById>[0],
  boardStyle: BoardStyleId,
  lockThemeAssets: boolean,
): BoardStyleId {
  return lockThemeAssets ? themeById(theme).defaultBoard : boardStyle;
}

export interface CaptureFxData {
  from: SquareName;
  to: SquareName;
  victim: { role: Role; color: Side };
}

/** Square center in 0–100% board coordinates. */
export function sqCenterPct(sq: SquareName, orientation: Side) {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]);
  let col: number;
  let row: number;
  if (orientation === "white") {
    col = file;
    row = 8 - rank;
  } else {
    col = 7 - file;
    row = rank - 1;
  }
  return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 };
}

export function victimOnSquare(
  before: Position,
  to: SquareName,
): { role: Role; color: Side } | null {
  const t = parseSquare(to);
  if (t == null) return null;
  const p = before.board.get(t);
  return p ? { role: p.role, color: p.color } : null;
}

export function animationsEnabled() {
  if (typeof window === "undefined") return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
