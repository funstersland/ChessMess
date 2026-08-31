import { chessgroundDests, lichessRules } from "chessops/compat";
import { normalizeMove, type Position } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan, parseSan } from "chessops/san";
import {
  isDrop,
  isNormal,
  ROLES,
  type Color,
  type Move,
  type Role,
} from "chessops/types";
import {
  makeSquare,
  makeUci,
  parseSquare,
  parseUci,
  squareRank,
} from "chessops/util";
import { defaultPosition, setupPosition } from "chessops/variant";
import { chess960Fen, random960Id } from "./chess960";
import type {
  GameSnapshot,
  LastMove,
  PieceOnSquare,
  Pocket,
  Role as AppRole,
  Side,
  SquareName,
  VariantId,
} from "./types";
import { variantById } from "./variants";

export const INITIAL_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function variantHasPockets(variant: VariantId): boolean {
  return variant === "crazyhouse";
}

export function isDropUci(uci: string): boolean {
  return uci.includes("@");
}

export function lastMoveFromUci(uci: string, color: Side): LastMove {
  if (isDropUci(uci)) {
    const to = uci.split("@")[1] as SquareName;
    return { to, color };
  }
  return {
    from: uci.slice(0, 2) as SquareName,
    to: uci.slice(2, 4) as SquareName,
    color,
  };
}

export function rulesFor(variant: VariantId) {
  return lichessRules(variantById(variant).lichess);
}

export function loadPosition(
  variant: VariantId,
  fen?: string,
  chess960Id?: number,
): Position {
  const rules = rulesFor(variant);
  if (variant === "chess960" && !fen) {
    const setup = parseFen(chess960Fen(chess960Id ?? random960Id()));
    if (setup.isErr) return defaultPosition("chess");
    const pos = setupPosition("chess", setup.value);
    return pos.isOk ? pos.value : defaultPosition("chess");
  }
  if (fen) {
    const setup = parseFen(fen);
    if (setup.isErr) return defaultPosition(rules);
    const pos = setupPosition(rules, setup.value);
    return pos.isOk ? pos.value : defaultPosition(rules);
  }
  return defaultPosition(rules);
}

export function fenOf(pos: Position): string {
  return makeFen(pos.toSetup());
}

function pocketFrom(pos: Position): Pocket | undefined {
  if (!pos.pockets) return undefined;
  const pack = (color: Color) => {
    const side = pos.pockets![color];
    const out: Pocket["white"] = {};
    for (const role of ROLES) {
      if (side[role] > 0) out[role as AppRole] = side[role];
    }
    return out;
  };
  return { white: pack("white"), black: pack("black") };
}

function dropLegal(pos: Position): GameSnapshot["dropLegal"] {
  const out: GameSnapshot["dropLegal"] = {};
  if (!pos.pockets) return out;
  const mine = pos.pockets[pos.turn];
  for (const role of ROLES) {
    if (mine[role] <= 0) continue;
    const squares: SquareName[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const move: Move = { role, to: sq };
      if (pos.isLegal(move)) squares.push(makeSquare(sq));
    }
    if (squares.length) out[role as AppRole] = squares;
  }
  return out;
}

export function snapshotOf(
  pos: Position,
  variant: VariantId,
): GameSnapshot {
  const dests = chessgroundDests(pos, { chess960: variant === "chess960" });
  const legal: Record<SquareName, SquareName[]> = {};
  for (const [from, tos] of dests) legal[from] = tos;

  const pieces: PieceOnSquare[] = [];
  for (const [sq, piece] of pos.board) {
    pieces.push({
      square: makeSquare(sq),
      role: piece.role as AppRole,
      color: piece.color,
      promoted: piece.promoted,
    });
  }

  const outcome = pos.outcome();
  let winner: Side | "draw" | undefined;
  let reason: string | undefined;
  if (outcome) {
    winner = outcome.winner ?? "draw";
    if (!outcome.winner) {
      if (pos.isStalemate()) reason = "stalemate";
      else if (pos.isInsufficientMaterial()) reason = "insufficient material";
      else reason = "draw";
    } else if (pos.isCheckmate()) reason = "checkmate";
    else if (pos.isVariantEnd()) reason = "variant win";
    else reason = "win";
  }

  const checksGiven =
    pos.remainingChecks != null
      ? {
          white: 3 - pos.remainingChecks.white,
          black: 3 - pos.remainingChecks.black,
        }
      : undefined;

  return {
    fen: fenOf(pos),
    turn: pos.turn,
    legal,
    dropLegal: dropLegal(pos),
    pieces,
    pocket: pocketFrom(pos),
    checksGiven,
    inCheck: pos.isCheck(),
    over: Boolean(outcome),
    winner,
    reason,
    canCastle: pos.castles.castlingRights.nonEmpty(),
    fullmoves: pos.fullmoves,
  };
}

export function generateMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const dests = pos.allDests();
  for (const [from, set] of dests) {
    for (const to of set) {
      const piece = pos.board.get(from);
      if (
        piece?.role === "pawn" &&
        (squareRank(to) === 0 || squareRank(to) === 7)
      ) {
        for (const promotion of ["queen", "rook", "bishop", "knight"] as Role[]) {
          const m: Move = { from, to, promotion };
          if (pos.isLegal(m)) moves.push(m);
        }
      } else {
        const m: Move = { from, to };
        moves.push(normalizeMove(pos, m));
      }
    }
  }
  if (pos.pockets) {
    const mine = pos.pockets[pos.turn];
    for (const role of ROLES) {
      if (mine[role] <= 0) continue;
      for (let to = 0; to < 64; to++) {
        const m: Move = { role, to };
        if (pos.isLegal(m)) moves.push(m);
      }
    }
  }
  return moves;
}

export function isPromotionMove(
  pos: Position,
  from: SquareName,
  to: SquareName,
): boolean {
  const f = parseSquare(from);
  const t = parseSquare(to);
  if (f == null || t == null) return false;
  const piece = pos.board.get(f);
  if (piece?.role !== "pawn") return false;
  const rank = squareRank(t);
  return rank === 0 || rank === 7;
}

export function playUci(
  pos: Position,
  uci: string,
): { san: string; captured?: Role } | null {
  const move = parseUci(uci);
  if (!move) return null;
  const normalized = isNormal(move) ? normalizeMove(pos, move) : move;
  if (!pos.isLegal(normalized)) return null;
  let captured: Role | undefined;
  if (isNormal(normalized)) {
    captured = pos.board.get(normalized.to)?.role;
  }
  const san = makeSan(pos, normalized);
  pos.play(normalized);
  return { san, captured };
}

export function playFromTo(
  pos: Position,
  from: SquareName,
  to: SquareName,
  promotion?: Role,
): { uci: string; san: string; captured?: Role } | null {
  const f = parseSquare(from);
  const t = parseSquare(to);
  if (f == null || t == null) return null;
  let move: Move = promotion
    ? { from: f, to: t, promotion }
    : { from: f, to: t };
  move = normalizeMove(pos, move);
  if (!pos.isLegal(move)) return null;
  const captured = isNormal(move) ? pos.board.get(move.to)?.role : undefined;
  const san = makeSan(pos, move);
  const uci = makeUci(move);
  pos.play(move);
  return { uci, san, captured };
}

export function playDrop(
  pos: Position,
  role: Role,
  to: SquareName,
): { uci: string; san: string } | null {
  const t = parseSquare(to);
  if (t == null) return null;
  const move: Move = { role, to: t };
  if (!pos.isLegal(move)) return null;
  const san = makeSan(pos, move);
  const uci = makeUci(move);
  pos.play(move);
  return { uci, san };
}

export function trySan(pos: Position, san: string): Move | undefined {
  return parseSan(pos, san);
}

export function uciOf(move: Move): string {
  return makeUci(move);
}

export function pieceAt(
  pos: Position,
  square: SquareName,
): { role: Role; color: Color } | undefined {
  const sq = parseSquare(square);
  if (sq == null) return undefined;
  return pos.board.get(sq);
}

export function clonePos(pos: Position): Position {
  return pos.clone();
}

export function files(): string[] {
  return ["a", "b", "c", "d", "e", "f", "g", "h"];
}

export function ranks(): string[] {
  return ["1", "2", "3", "4", "5", "6", "7", "8"];
}

export function squareName(file: number, rank: number): SquareName {
  return `${"abcdefgh"[file]}${rank + 1}`;
}

export function materialCount(pos: Position): { white: number; black: number } {
  const val: Record<Role, number> = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0,
  };
  const out = { white: 0, black: 0 };
  for (const [, piece] of pos.board) {
    out[piece.color] += val[piece.role];
  }
  if (pos.pockets) {
    for (const role of ROLES) {
      out.white += val[role] * pos.pockets.white[role];
      out.black += val[role] * pos.pockets.black[role];
    }
  }
  return out;
}

export function capturedFromStart(
  pos: Position,
  variant: VariantId,
): { white: AppRole[]; black: AppRole[] } {
  // Pieces missing vs a standard army ( palettes for display ).
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const roleChar: Record<string, AppRole> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };
  const count = (color: Color) => {
    const c = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
    for (const [, piece] of pos.board) {
      if (piece.color !== color) continue;
      const ch = piece.role[0] === "k" ? "k" : piece.role[0];
      if (ch in c) c[ch as keyof typeof c]++;
    }
    if (pos.pockets) {
      const p = pos.pockets[color];
      c.p += p.pawn;
      c.n += p.knight;
      c.b += p.bishop;
      c.r += p.rook;
      c.q += p.queen;
      c.k += p.king;
    }
    return c;
  };
  if (variant === "horde" || variant === "racingkings") {
    return { white: [], black: [] };
  }
  const w = count("white");
  const b = count("black");
  const missing = (have: typeof w): AppRole[] => {
    const list: AppRole[] = [];
    for (const [ch, n] of Object.entries(start) as [keyof typeof start, number][]) {
      const lost = Math.max(0, n - have[ch]);
      for (let i = 0; i < lost; i++) list.push(roleChar[ch]);
    }
    return list;
  };
  // Captured by white = missing from black, etc.
  return { white: missing(b), black: missing(w) };
}

export function downloadPgn(pgn: string, filename = "chessmess.pgn") {
  const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildPgn(opts: {
  white: string;
  black: string;
  variant: VariantId;
  result: string;
  fen?: string;
  sans: string[];
  timeControl?: string;
}): string {
  const headers: string[] = [
    `[Event "ChessMess"]`,
    `[Site "ChessMess"]`,
    `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}"]`,
    `[White "${opts.white}"]`,
    `[Black "${opts.black}"]`,
    `[Result "${opts.result}"]`,
    `[Variant "${variantById(opts.variant).name}"]`,
  ];
  if (opts.timeControl && opts.timeControl !== "none") {
    headers.push(`[TimeControl "${opts.timeControl}"]`);
  }
  if (opts.fen && opts.fen !== INITIAL_FEN) {
    headers.push(`[SetUp "1"]`);
    headers.push(`[FEN "${opts.fen}"]`);
  }
  const moves: string[] = [];
  for (let i = 0; i < opts.sans.length; i++) {
    if (i % 2 === 0) moves.push(`${Math.floor(i / 2) + 1}. ${opts.sans[i]}`);
    else moves.push(opts.sans[i]);
  }
  return `${headers.join("\n")}\n\n${moves.join(" ")} ${opts.result}\n`;
}
