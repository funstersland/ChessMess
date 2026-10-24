import { normalizeMove, type Position } from "chessops/chess";
import { isNormal } from "chessops/types";
import { makeSan } from "chessops/san";
import { makeSquare, makeUci, parseUci, squareFile, squareRank } from "chessops/util";
import { clonePos, fenOf, loadPosition, playUci } from "@/lib/chess/engine";
import { classifyCpLoss } from "@/lib/chess/rating";
import type { AnalyzeItem, BotId, MoveClass, VariantId } from "@/lib/chess/types";
import { botById } from "@/lib/chess/variants";

/*
 * Driver for the bundled multi-variant Stockfish (niklasf/stockfish.js,
 * 2019-08-15). It is a single-threaded build with a fixed 16 MB hash, so it
 * must never be sent `setoption name Threads` (the worker hangs and never
 * answers `isready` again) and it has no UCI_LimitStrength / UCI_Elo — bot
 * strength comes from "Skill Level" plus depth and time limits.
 */

const WASM = "/engines/stockfish.wasm.js";
const ASM = "/engines/stockfish.js";

/** Centipawn value used for "mate on the board"; matches the mate encoding below. */
export const MATE_CP = 30000;

export interface EnginePv {
  uci: string;
  san: string;
  /** Centipawns, side-to-move positive. */
  cp: number;
}

export interface SearchResult {
  /** Principal variations, best first. */
  pvs: EnginePv[];
  /**
   * The move the engine actually chose. With Skill Level below 20 Stockfish
   * deliberately picks a weaker move than `pvs[0]`, so bots must play this.
   */
  bestmove: string | null;
}

type Waiter = {
  pred: (line: string) => boolean;
  resolve: (lines: string[]) => void;
  reject: (err: Error) => void;
  timer: number;
};

export type SearchOpts = {
  depth?: number;
  movetime?: number;
  /**
   * Stockfish "Skill Level", 0–20. Omit for a full-strength analysis search,
   * which also turns contempt off so scores are neutral.
   */
  skill?: number;
  multipv?: number;
  /** Restrict the search to these moves (app UCI, see `canonicalUci`). */
  searchmoves?: string[];
};

function lineOf(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "data" in data) {
    const inner = (data as { data: unknown }).data;
    if (typeof inner === "string") return inner;
  }
  return String(data ?? "");
}

function uciVariant(v: VariantId): string {
  switch (v) {
    case "kingofthehill":
      return "kingofthehill";
    case "threecheck":
      return "3check";
    case "crazyhouse":
      return "crazyhouse";
    case "antichess":
      return "giveaway";
    case "atomic":
      return "atomic";
    case "horde":
      return "horde";
    case "racingkings":
      return "racingkings";
    default:
      return "chess";
  }
}

/**
 * Chess960 castling must be sent and received as "king takes own rook"
 * (e.g. b1a1). Without UCI_Chess960 the engine writes castling as a king move
 * to the c/g file, which is ambiguous or illegal in most 960 start positions.
 */
function usesChess960(v: VariantId): boolean {
  return v === "chess960" || v === "fromposition";
}

function clampSkill(skill: number): number {
  return Math.max(0, Math.min(20, Math.round(skill)));
}

// UCI move: normal (with optional promotion, incl. king in antichess) or drop.
const UCI_MOVE = "(?:[a-h][1-8][a-h][1-8][qrbnk]?|[NBRQKP]@[a-h][1-8])";
const PV_RE = new RegExp(` pv (${UCI_MOVE}(?:\\s+${UCI_MOVE})*)`);
const BESTMOVE_RE = /^bestmove (\S+)/;

/**
 * The app's UCI form: chessops' normalised move, so castling is always
 * "king takes own rook" (e1h1). The engine writes e1g1 outside Chess960 mode;
 * converting keeps engine moves comparable with moves the player made.
 */
function canonicalUci(pos: Position, uci: string): string {
  const move = parseUci(uci);
  if (!move) return uci;
  return makeUci(isNormal(move) ? normalizeMove(pos, move) : move);
}

/** Inverse of `canonicalUci` for moves sent to the engine (searchmoves). */
function engineUci(pos: Position, uci: string, variant: VariantId): string {
  if (usesChess960(variant)) return uci;
  const move = parseUci(uci);
  if (!move || !isNormal(move)) return uci;
  const mover = pos.board.get(move.from);
  const target = pos.board.get(move.to);
  const castles =
    mover?.role === "king" && target?.role === "rook" && target.color === mover.color;
  if (!castles) return uci;
  const file = squareFile(move.to) > squareFile(move.from) ? 6 : 2;
  return makeSquare(move.from) + makeSquare(squareRank(move.from) * 8 + file);
}

function sanOf(pos: Position, uci: string): string {
  const move = parseUci(uci);
  if (!move) return uci;
  const n = isNormal(move) ? normalizeMove(pos, move) : move;
  try {
    return makeSan(pos, n);
  } catch {
    return uci;
  }
}

function parsePvs(lines: string[], fen: string, variant: VariantId): EnginePv[] {
  const byPv = new Map<number, { uci: string; cp: number }>();
  for (const line of lines) {
    if (!line.startsWith("info ") || !line.includes(" pv ")) continue;
    const mp = /multipv (\d+)/.exec(line);
    const idx = mp ? Number(mp[1]) : 1;
    const pv = PV_RE.exec(line);
    if (!pv) continue;
    const first = pv[1]!.split(/\s+/)[0]!;
    let cp = 0;
    const mate = / score mate (-?\d+)/.exec(line);
    const cpM = / score cp (-?\d+)/.exec(line);
    if (mate) {
      const n = Number(mate[1]);
      cp = n === 0 ? 0 : n > 0 ? MATE_CP - n : -MATE_CP - n;
    } else if (cpM) {
      cp = Number(cpM[1]);
    }
    byPv.set(idx, { uci: first, cp });
  }
  const pos = loadPosition(variant, fen);
  const out: EnginePv[] = [];
  for (const idx of [...byPv.keys()].sort((a, b) => a - b)) {
    const hit = byPv.get(idx)!;
    out.push({ uci: canonicalUci(pos, hit.uci), san: sanOf(pos, hit.uci), cp: hit.cp });
  }
  return out;
}

/**
 * Score of a finished position from the side to move's point of view, or
 * null when the game is still going. Stockfish answers `bestmove (none)` (the
 * asm build answers nothing at all) for these, so they must never be searched.
 */
export function terminalCp(pos: Position): number | null {
  const outcome = pos.outcome();
  if (!outcome) return null;
  if (!outcome.winner) return 0;
  return outcome.winner === pos.turn ? MATE_CP : -MATE_CP;
}

export class StockfishClient {
  private worker: Worker | null = null;
  private buffer: string[] = [];
  private waiter: Waiter | null = null;
  private ready: Promise<boolean> | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private failed = false;
  private via: "wasm" | "asm" | null = null;

  get available() {
    return !this.failed;
  }

  get backend() {
    return this.via;
  }

  private onMessage = (ev: MessageEvent) => {
    const line = lineOf(ev.data).trim();
    if (!line) return;
    this.buffer.push(line);
    const w = this.waiter;
    if (w?.pred(line)) {
      window.clearTimeout(w.timer);
      const lines = this.buffer;
      this.buffer = [];
      this.waiter = null;
      w.resolve(lines);
    }
  };

  /**
   * Resolve with every buffered line up to and including the first one that
   * matches `pred`. Only one wait is ever outstanding: searches are chained
   * and booting is shared through `ensure()`.
   */
  private wait(pred: (line: string) => boolean, ms: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const hit = this.buffer.findIndex(pred);
      if (hit >= 0) {
        const lines = this.buffer.slice(0, hit + 1);
        this.buffer = this.buffer.slice(hit + 1);
        resolve(lines);
        return;
      }
      const prev = this.waiter;
      if (prev) {
        window.clearTimeout(prev.timer);
        prev.reject(new Error("Stockfish wait superseded"));
      }
      const waiter: Waiter = { pred, resolve, reject, timer: 0 };
      waiter.timer = window.setTimeout(() => {
        // A stale timer must never touch a newer wait or a fresh worker.
        if (this.waiter !== waiter) return;
        this.waiter = null;
        reject(new Error("Stockfish timeout"));
      }, ms);
      this.waiter = waiter;
    });
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private async boot(url: string, timeout: number): Promise<void> {
    const w = new Worker(url);
    this.worker = w;
    this.buffer = [];
    w.onmessage = this.onMessage;
    w.onerror = () => {
      /* the handshake timeout handles it */
    };
    this.send("uci");
    await this.wait((l) => l === "uciok", timeout);
    this.send("isready");
    await this.wait((l) => l === "readyok", 5000);
  }

  /** Boot the engine once; concurrent callers share the same handshake. */
  ensure(): Promise<boolean> {
    if (this.failed) return Promise.resolve(false);
    this.ready ??= (async () => {
      try {
        await this.boot(WASM, 14000);
        this.via = "wasm";
        return true;
      } catch {
        this.teardown();
        try {
          await this.boot(ASM, 22000);
          this.via = "asm";
          return true;
        } catch {
          this.teardown();
          this.failed = true;
          return false;
        }
      }
    })();
    return this.ready;
  }

  private teardown() {
    const w = this.waiter;
    this.waiter = null;
    if (w) {
      window.clearTimeout(w.timer);
      w.reject(new Error("Stockfish reset"));
    }
    this.worker?.terminate();
    this.worker = null;
    this.buffer = [];
    this.via = null;
  }

  /** Throw away a wedged worker so the next search boots a clean one. */
  recover(_reason?: string) {
    this.teardown();
    this.ready = null;
    this.failed = false;
  }

  search(fen: string, variant: VariantId, opts: SearchOpts = {}): Promise<SearchResult> {
    const run = async (): Promise<SearchResult> => {
      try {
        const ok = await this.ensure();
        if (!ok || !this.worker) throw new Error("Stockfish failed to start");
        const multipv = opts.multipv ?? 1;
        const analysis = opts.skill == null;
        const skill = analysis ? 20 : clampSkill(opts.skill!);
        this.send("ucinewgame");
        this.send(`setoption name UCI_Variant value ${uciVariant(variant)}`);
        this.send(`setoption name UCI_Chess960 value ${usesChess960(variant)}`);
        this.send(`setoption name Skill Level value ${skill}`);
        // Contempt skews scores toward the side to move; bots keep the default.
        this.send(`setoption name Contempt value ${analysis ? 0 : 24}`);
        this.send(`setoption name MultiPV value ${multipv}`);
        this.send("isready");
        await this.wait((l) => l === "readyok", 5000);
        this.send(`position fen ${fen}`);
        const root = loadPosition(variant, fen);
        const parts: string[] = ["go"];
        if (opts.depth) parts.push(`depth ${opts.depth}`);
        if (opts.movetime) parts.push(`movetime ${opts.movetime}`);
        if (!opts.depth && !opts.movetime) parts.push("movetime 380");
        if (opts.searchmoves?.length) {
          parts.push("searchmoves", ...opts.searchmoves.map((m) => engineUci(root, m, variant)));
        }
        this.send(parts.join(" "));
        const timeout = Math.max(6000, (opts.movetime ?? 380) + 4000);
        const lines = await this.wait((l) => l.startsWith("bestmove"), timeout);
        const bm = BESTMOVE_RE.exec(lines[lines.length - 1] ?? "");
        const bestmove = bm && bm[1] !== "(none)" ? canonicalUci(root, bm[1]!) : null;
        return { pvs: parsePvs(lines, fen, variant), bestmove };
      } catch (err) {
        this.recover(err instanceof Error ? err.message : "search failed");
        throw err;
      }
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** Fair-play scan — top three lines at a fixed depth. */
  async analyze(fen: string, variant: VariantId, depth = 10, movetime = 360): Promise<EnginePv[]> {
    if (terminalCp(loadPosition(variant, fen)) != null) return [];
    const res = await this.search(fen, variant, { depth, movetime, multipv: 3 });
    return res.pvs;
  }

  dispose() {
    this.teardown();
    this.ready = null;
    this.failed = false;
  }
}

let moveSingleton: StockfishClient | null = null;
let analysisSingleton: StockfishClient | null = null;

export function getStockfish(kind: "move" | "analysis" = "analysis"): StockfishClient {
  if (typeof window === "undefined") {
    throw new Error("Stockfish is browser-only");
  }
  if (kind === "move") {
    moveSingleton ??= new StockfishClient();
    return moveSingleton;
  }
  analysisSingleton ??= new StockfishClient();
  return analysisSingleton;
}

/** Best line for `pos`, or the exact score when the game is already over. */
async function bestFor(
  sf: StockfishClient,
  pos: Position,
  variant: VariantId,
  opts: SearchOpts,
): Promise<EnginePv | null> {
  const done = terminalCp(pos);
  if (done != null) return { uci: "", san: "", cp: done };
  const res = await sf.search(fenOf(pos), variant, opts);
  return res.pvs[0] ?? null;
}

/**
 * Score of playing `uci` in `pos`, from the mover's side, searched from the
 * same root and depth as the best move so the two numbers are comparable.
 */
async function playedFor(
  sf: StockfishClient,
  pos: Position,
  variant: VariantId,
  uci: string,
  best: EnginePv,
  opts: SearchOpts,
): Promise<number | null> {
  if (uci === best.uci) return best.cp;
  const next = clonePos(pos);
  if (!playUci(next, uci)) return null;
  const done = terminalCp(next);
  if (done != null) return -done;
  const res = await sf.search(fenOf(pos), variant, { ...opts, searchmoves: [uci] });
  return res.pvs[0]?.cp ?? null;
}

export const engineClient = {
  async move(fen: string, variant: VariantId, strength: BotId) {
    const spec = botById(strength);
    const res = await getStockfish("move").search(fen, variant, {
      skill: spec.skill,
      depth: spec.depth,
      movetime: spec.movetimeMs,
    });
    const uci = res.bestmove ?? res.pvs[0]?.uci;
    if (!uci) throw new Error("no move");
    const check = loadPosition(variant, fen);
    const played = playUci(check, uci);
    if (!played) throw new Error(`engine returned an illegal move: ${uci}`);
    const pv = res.pvs.find((p) => p.uci === uci) ?? res.pvs[0];
    return { uci, san: played.san, eval: pv?.cp ?? 0 };
  },

  async hint(fen: string, variant: VariantId) {
    const res = await getStockfish("analysis").search(fen, variant, {
      depth: 14,
      movetime: 1800,
      multipv: 1,
    });
    const best = res.pvs[0];
    if (!best) throw new Error("no hint");
    return { uci: best.uci, san: best.san, eval: best.cp };
  },

  async score(fen: string, variant: VariantId, uci: string) {
    const sf = getStockfish("analysis");
    const pos = loadPosition(variant, fen);
    const opts: SearchOpts = { depth: 12, movetime: 1200, multipv: 1 };
    const best = await bestFor(sf, pos, variant, opts);
    if (!best) throw new Error("no score");
    const canonical = canonicalUci(pos, uci);
    const playedCp = (await playedFor(sf, pos, variant, canonical, best, opts)) ?? best.cp;
    const loss = best.cp - playedCp;
    return {
      cpLoss: Math.max(0, loss),
      classification: classifyCpLoss(loss) as MoveClass,
      bestUci: best.uci,
      bestSan: best.san,
      bestCp: best.cp,
      playedCp,
    };
  },

  async analyze(startFen: string, variant: VariantId, ucis: string[]) {
    const sf = getStockfish("analysis");
    const items: AnalyzeItem[] = [];
    const pos = loadPosition(variant, startFen);
    const opts: SearchOpts = { depth: 11, movetime: 700, multipv: 1 };
    for (let i = 0; i < ucis.length; i++) {
      const uci = canonicalUci(pos, ucis[i]!);
      const best = await bestFor(sf, pos, variant, opts);
      const playedCp = best ? ((await playedFor(sf, pos, variant, uci, best, opts)) ?? best.cp) : 0;
      const playedRes = playUci(pos, uci);
      const bestCp = best?.cp ?? 0;
      const loss = bestCp - playedCp;
      items.push({
        ply: i,
        san: playedRes?.san ?? uci,
        uci,
        classification: classifyCpLoss(loss),
        cpLoss: Math.max(0, Math.round(loss)),
        bestSan: best?.san || undefined,
        cp: Math.round(playedCp),
      });
    }
    return { items };
  },
};
