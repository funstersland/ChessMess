import { normalizeMove } from "chessops/chess";
import { isNormal } from "chessops/types";
import { makeSan } from "chessops/san";
import { parseUci } from "chessops/util";
import { clonePos, fenOf, loadPosition, playUci } from "@/lib/chess/engine";
import { classifyCpLoss } from "@/lib/chess/rating";
import type { AnalyzeItem, BotId, MoveClass, VariantId } from "@/lib/chess/types";
import { botById } from "@/lib/chess/variants";

const WASM = "/engines/stockfish.wasm.js";
const ASM = "/engines/stockfish.js";

export interface EnginePv {
  uci: string;
  san: string;
  /** Centipawns, side-to-move positive. */
  cp: number;
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
  /** Stockfish UCI_Elo — enables limit strength when set. */
  elo?: number;
  multipv?: number;
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
    case "chess960":
      return "chess";
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

function clampElo(elo: number): number {
  return Math.max(1320, Math.min(3190, Math.round(elo)));
}

const PV_RE =
  / pv ((?:[a-h][1-8][a-h][1-8][qrbn]?|[NBRQKP]@[a-h][1-8](?:[qrbn])?)(?:\s+(?:[a-h][1-8][a-h][1-8][qrbn]?|[NBRQKP]@[a-h][1-8](?:[qrbn])?))*)/;

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
      cp = n === 0 ? 0 : n > 0 ? 30000 - n : -30000 - n;
    } else if (cpM) {
      cp = Number(cpM[1]);
    }
    byPv.set(idx, { uci: first, cp });
  }
  const pos = loadPosition(variant, fen);
  const out: EnginePv[] = [];
  for (const idx of [...byPv.keys()].sort((a, b) => a - b)) {
    const hit = byPv.get(idx)!;
    const move = parseUci(hit.uci);
    let san = hit.uci;
    if (move) {
      const n = isNormal(move) ? normalizeMove(pos, move) : move;
      try {
        san = makeSan(pos, n);
      } catch {
        san = hit.uci;
      }
    }
    out.push({ uci: hit.uci, san, cp: hit.cp });
  }
  return out;
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
    if (this.waiter?.pred(line)) {
      window.clearTimeout(this.waiter.timer);
      const lines = this.buffer.slice();
      this.buffer = [];
      const w = this.waiter;
      this.waiter = null;
      w.resolve(lines);
    }
  };

  private wait(pred: (line: string) => boolean, ms: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const already = this.buffer.find(pred);
      if (already) {
        const lines = this.buffer.slice();
        this.buffer = [];
        resolve(lines);
        return;
      }
      const timer = window.setTimeout(() => {
        this.waiter = null;
        this.recover("timeout");
        reject(new Error("Stockfish timeout"));
      }, ms);
      this.waiter = { pred, resolve, reject, timer };
    });
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private async boot(url: string, timeout: number): Promise<Worker> {
    const w = new Worker(url);
    this.worker = w;
    this.buffer = [];
    w.onmessage = this.onMessage;
    w.onerror = () => {
      /* handshake timeout handles it */
    };
    this.send("uci");
    await this.wait((l) => l === "uciok", timeout);
    this.send("setoption name Hash value 32");
    this.send("setoption name Threads value 1");
    this.send("isready");
    await this.wait((l) => l === "readyok", 5000);
    return w;
  }

  async ensure(): Promise<boolean> {
    if (this.failed) return false;
    if (this.worker) return true;
    if (this.ready) return this.ready;
    this.ready = (async () => {
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
    if (this.waiter) {
      window.clearTimeout(this.waiter.timer);
      this.waiter = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.buffer = [];
    this.via = null;
  }

  /** Reset a wedged worker so the next search boots clean. */
  recover(_reason?: string) {
    this.teardown();
    this.ready = null;
    this.failed = false;
    this.chain = Promise.resolve();
  }

  private async configureVariant(variant: VariantId) {
    const v = variant === "standard" || variant === "fromposition" ? "chess" : uciVariant(variant);
    this.send(`setoption name UCI_Variant value ${v}`);
    this.send("isready");
    await this.wait((l) => l === "readyok", 4000);
  }

  private async configureStrength(elo?: number) {
    if (elo != null) {
      this.send("setoption name UCI_LimitStrength value true");
      this.send(`setoption name UCI_Elo value ${clampElo(elo)}`);
    } else {
      this.send("setoption name UCI_LimitStrength value false");
    }
    this.send("isready");
    await this.wait((l) => l === "readyok", 4000);
  }

  search(fen: string, variant: VariantId, opts: SearchOpts = {}): Promise<EnginePv[]> {
    const run = async (): Promise<EnginePv[]> => {
      try {
        const ok = await this.ensure();
        if (!ok || !this.worker) throw new Error("Stockfish failed to start");
        const multipv = opts.multipv ?? 1;
        this.send("ucinewgame");
        await this.configureVariant(variant);
        await this.configureStrength(opts.elo);
        this.send(`setoption name MultiPV value ${multipv}`);
        this.send("isready");
        await this.wait((l) => l === "readyok", 4000);
        this.send(`position fen ${fen}`);
        const parts: string[] = ["go"];
        if (opts.depth) parts.push(`depth ${opts.depth}`);
        if (opts.movetime) parts.push(`movetime ${opts.movetime}`);
        if (parts.length === 1) parts.push("movetime 380");
        this.send(parts.join(" "));
        const timeout = Math.max(6000, (opts.movetime ?? 380) + 4000);
        const lines = await this.wait((l) => l.startsWith("bestmove"), timeout);
        return parsePvs(lines, fen, variant);
      } catch (err) {
        this.recover(err instanceof Error ? err.message : "search failed");
        throw err;
      }
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** Fair-play scan — same as search with fixed depth. */
  analyze(fen: string, variant: VariantId, depth = 10, movetime = 360): Promise<EnginePv[]> {
    return this.search(fen, variant, { depth, movetime, multipv: 3 });
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
/** Map ladder rating label to Stockfish UCI_Elo. */
export function botUciElo(rating: number): number {
  return clampElo(rating);
}

export const engineClient = {
  async move(fen: string, variant: VariantId, strength: BotId) {
    const spec = botById(strength);
    const pvs = await getStockfish("move").search(fen, variant, {
      elo: botUciElo(spec.rating),
      movetime: spec.movetimeMs,
      depth: spec.depth,
    });
    const best = pvs[0];
    if (!best) throw new Error("no move");
    return { uci: best.uci, san: best.san, eval: best.cp };
  },

  async hint(fen: string, variant: VariantId) {
    const pvs = await getStockfish("analysis").search(fen, variant, {
      depth: 14,
      movetime: 1800,
      multipv: 1,
    });
    const best = pvs[0];
    if (!best) throw new Error("no hint");
    return { uci: best.uci, san: best.san, eval: best.cp };
  },

  async score(fen: string, variant: VariantId, uci: string) {
    const sf = getStockfish("analysis");
    const bestPvs = await sf.search(fen, variant, { depth: 12, movetime: 1200, multipv: 1 });
    const best = bestPvs[0];
    if (!best) throw new Error("no score");
    const pos = loadPosition(variant, fen);
    const played = parseUci(uci);
    let playedCp = best.cp;
    if (played && pos.isLegal(isNormal(played) ? normalizeMove(pos, played) : played)) {
      const next = clonePos(pos);
      playUci(next, uci);
      const after = await sf.search(fenOf(next), variant, { depth: 10, movetime: 600, multipv: 1 });
      playedCp = after[0] ? -after[0].cp : best.cp;
    }
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
    let pos = loadPosition(variant, startFen);
    for (let i = 0; i < ucis.length; i++) {
      const fen = fenOf(pos);
      const bestPvs = await sf.search(fen, variant, { depth: 11, movetime: 700, multipv: 1 });
      const best = bestPvs[0];
      const uci = ucis[i]!;
      const playedRes = playUci(pos, uci);
      const afterFen = fenOf(pos);
      const afterPvs = await sf.search(afterFen, variant, { depth: 9, movetime: 450, multipv: 1 });
      const playedCp = afterPvs[0] ? -afterPvs[0].cp : 0;
      const bestCp = best?.cp ?? 0;
      const loss = bestCp - playedCp;
      items.push({
        ply: i,
        san: playedRes?.san ?? uci,
        uci,
        classification: classifyCpLoss(loss),
        cpLoss: Math.max(0, Math.round(loss)),
        bestSan: best?.san,
        cp: Math.round(playedCp),
      });
    }
    return { items };
  },
};