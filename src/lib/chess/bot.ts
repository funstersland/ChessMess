import type { AnalyzeItem, BotId, VariantId } from "./types";
import { getStockfish, engineClient } from "./stockfish";

/** Stockfish-backed engine for bots, coach hints, and post-game analysis. */
export const botClient = {
  prewarm() {
    return getStockfish("move").ensure();
  },
  /** `movetimeCapMs` limits the search when the bot is on a clock. */
  move(fen: string, variant: VariantId, strength: BotId, movetimeCapMs?: number) {
    return engineClient.move(fen, variant, strength, movetimeCapMs);
  },
  hint(fen: string, variant: VariantId) {
    return engineClient.hint(fen, variant);
  },
  score(fen: string, variant: VariantId, uci: string) {
    return engineClient.score(fen, variant, uci);
  },
  analyze(startFen: string, variant: VariantId, ucis: string[]) {
    return engineClient.analyze(startFen, variant, ucis);
  },
};

export type { AnalyzeItem };
