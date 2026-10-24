import { parseFen } from "chessops/fen";
import { setupPosition } from "chessops/variant";
import { drawByRule, playUci, repetitionKey, rulesFor, timeoutResult } from "./engine";
import type { Side, TimeControlId, VariantId } from "./types";

export type ClaimedResult = "win" | "draw" | "loss";

export interface GameRecord {
  variant: VariantId;
  fenStart: string;
  ucis: string[];
  /** The player's colour; `result` is from their point of view. */
  color: Side;
  result: ClaimedResult;
  reason: string;
  timeControl: TimeControlId;
}

export type GameCheck = { ok: true } | { ok: false; error: string };

const bad = (error: string): GameCheck => ({ ok: false, error });

/**
 * Replays a finished game and checks that the claimed result is possible.
 *
 * Results the board decides (mate, stalemate, variant wins, repetition, the
 * fifty-move rule) must match exactly. A loss can always be conceded. A win
 * or draw in an unfinished position is only accepted as a timeout in a timed
 * game, and only if the side with time left could still mate. Everything
 * else — e.g. a "win" in the middle of a game — is rejected, so a rated
 * result can no longer be invented in the browser.
 */
export function checkGameRecord(g: GameRecord): GameCheck {
  const setup = parseFen(g.fenStart);
  if (setup.isErr) return bad("The start position is not a valid FEN.");
  const start = setupPosition(rulesFor(g.variant), setup.value);
  if (start.isErr) return bad("The start position is not legal for this variant.");
  const pos = start.value;

  const keys = [repetitionKey(pos)];
  for (let i = 0; i < g.ucis.length; i++) {
    if (pos.isEnd()) return bad(`Move ${i + 1} was played after the game ended.`);
    if (i > 0 && drawByRule(pos, g.variant, keys)) {
      return bad(`Move ${i + 1} was played after the game was drawn.`);
    }
    if (!playUci(pos, g.ucis[i]!)) return bad(`Move ${i + 1} (${g.ucis[i]}) is illegal.`);
    keys.push(repetitionKey(pos));
  }

  const me = g.color;
  const opp: Side = me === "white" ? "black" : "white";
  const fromMine = (w: Side | "draw"): ClaimedResult => (w === "draw" ? "draw" : w === me ? "win" : "loss");

  const outcome = pos.outcome();
  if (outcome) {
    return fromMine(outcome.winner ?? "draw") === g.result
      ? { ok: true }
      : bad("The result does not match the final position.");
  }
  if (drawByRule(pos, g.variant, keys)) {
    return g.result === "draw" ? { ok: true } : bad("The game ended in a draw by rule.");
  }

  // The board shows a game still in progress.
  if (g.result === "loss") return { ok: true };
  if (g.reason === "on time" && g.timeControl !== "none") {
    const ifOppFlagged = timeoutResult(pos, opp);
    const ifIFlagged = timeoutResult(pos, me);
    if (g.result === "win" && ifOppFlagged === me) return { ok: true };
    if (g.result === "draw" && (ifOppFlagged === "draw" || ifIFlagged === "draw")) return { ok: true };
  }
  return bad("This result cannot be verified from the moves played.");
}
