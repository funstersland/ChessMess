import { makeFen } from "chessops/fen";
import { parsePgn, startingPosition } from "chessops/pgn";
import { parseSan } from "chessops/san";
import { makeUci } from "chessops/util";
import type { Side, VariantId } from "@/lib/chess/types";
import { loadPosition, playUci } from "@/lib/chess/engine";

export interface ParsedMove {
  ply: number;
  san: string;
  uci: string;
  color: Side;
  fenBefore: string;
  fenAfter: string;
}

export interface ParsedGame {
  fenStart: string;
  moves: ParsedMove[];
  white: string;
  black: string;
  result: string;
  variant: VariantId;
}

const VARIANT_MAP: Record<string, VariantId> = {
  standard: "standard",
  chess: "standard",
  chess960: "chess960",
  "fischerandom": "chess960",
  kingofthehill: "kingofthehill",
  "king of the hill": "kingofthehill",
  threecheck: "threecheck",
  "three-check": "threecheck",
  crazyhouse: "crazyhouse",
  antichess: "antichess",
  atomic: "atomic",
  horde: "horde",
  racingkings: "racingkings",
  "racing kings": "racingkings",
  fromposition: "fromposition",
};

export function parseGamePgn(pgn: string): ParsedGame {
  const games = parsePgn(pgn.trim());
  const game = games[0];
  if (!game) throw new Error("No game in that PGN.");
  const header = (k: string) => game.headers.get(k) ?? "";
  const variantKey = header("Variant").toLowerCase() || "standard";
  const variant: VariantId = VARIANT_MAP[variantKey] ?? "standard";
  const start = startingPosition(game.headers);
  const pos = start.isOk
    ? start.value
    : loadPosition(variant, header("FEN") || undefined);
  const fenStart = makeFen(pos.toSetup());
  const moves: ParsedMove[] = [];
  let ply = 0;
  for (const node of game.moves.mainline()) {
    const move = parseSan(pos, node.san);
    if (!move) break;
    const fenBefore = makeFen(pos.toSetup());
    const color = pos.turn as Side;
    const uci = makeUci(move);
    pos.play(move);
    moves.push({
      ply,
      san: node.san,
      uci,
      color,
      fenBefore,
      fenAfter: makeFen(pos.toSetup()),
    });
    ply += 1;
  }
  if (moves.length === 0) throw new Error("That PGN has no legal moves.");
  return {
    fenStart,
    moves,
    white: header("White") || "White",
    black: header("Black") || "Black",
    result: header("Result") || "*",
    variant,
  };
}

export function replayUcis(
  fenStart: string,
  ucis: string[],
  variant: VariantId = "standard",
): ParsedGame {
  const pos = loadPosition(variant, fenStart);
  const moves: ParsedMove[] = [];
  for (let i = 0; i < ucis.length; i++) {
    const uci = ucis[i]!;
    const fenBefore = makeFen(pos.toSetup());
    const color = pos.turn as Side;
    const played = playUci(pos, uci);
    if (!played) break;
    moves.push({
      ply: i,
      san: played.san,
      uci,
      color,
      fenBefore,
      fenAfter: makeFen(pos.toSetup()),
    });
  }
  if (moves.length === 0) throw new Error("No legal moves to scan.");
  return {
    fenStart,
    moves,
    white: "White",
    black: "Black",
    result: "*",
    variant,
  };
}
