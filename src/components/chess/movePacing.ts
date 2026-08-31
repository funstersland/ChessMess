import type { BoardStyleId, Role, Side, SquareName } from "@/lib/chess/types";
import {
  boardHasCaptureFx,
  type CaptureFxBoardId,
} from "./captureFx";

export interface MoveSlideData {
  from: SquareName;
  to: SquareName;
  role: Role;
  color: Side;
}

/** Piece slide from square to square. */
export const MOVE_SLIDE_MS = 550;

/** Minimum bot "thinking" time after the engine returns. */
export const BOT_THINK_MIN_MS = 1100;
export const BOT_THINK_MAX_MS = 2000;

/** Pause after your move before the bot starts thinking. */
export const POST_MOVE_BEFORE_BOT_MS = 450;

/** Extra beat after a capture presentation finishes. */
export const POST_CAPTURE_PAUSE_MS = 300;

const CAPTURE_FX_MS: Record<CaptureFxBoardId, number> = {
  wood: 1200,
  royal: 1180,
  ice: 1280,
  noir: 1380,
  forest: 1180,
  ocean: 1280,
  paper: 1220,
};

export function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function captureFxDurationMs(board: BoardStyleId) {
  return boardHasCaptureFx(board) ? CAPTURE_FX_MS[board] : 0;
}

export async function botThinkDelay(elapsedMs: number) {
  const target =
    BOT_THINK_MIN_MS + Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS);
  if (elapsedMs < target) await sleep(target - elapsedMs);
}

/** Wait for slide + capture overlay before the next bot turn. */
export async function waitBeforeBotTurn(
  animations: boolean,
  captured: boolean,
  board: BoardStyleId,
) {
  if (!animations) {
    await sleep(POST_MOVE_BEFORE_BOT_MS);
    return;
  }
  const fxMs = captured ? captureFxDurationMs(board) : 0;
  const pause = captured ? POST_CAPTURE_PAUSE_MS : POST_MOVE_BEFORE_BOT_MS;
  await sleep(Math.max(MOVE_SLIDE_MS, fxMs) + pause);
}

/** Wait after a bot move is shown before handing control back. */
export async function waitAfterBotMove(
  animations: boolean,
  captured: boolean,
  board: BoardStyleId,
) {
  if (!animations) {
    await sleep(280);
    return;
  }
  const fxMs = captured ? captureFxDurationMs(board) : 0;
  await sleep(Math.max(MOVE_SLIDE_MS, fxMs) + POST_CAPTURE_PAUSE_MS);
}
