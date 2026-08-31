import type { AnalyzeItem, BotId, VariantId } from "./types";
import { engineClient } from "./stockfish";

/** Stockfish-backed engine for bots, coach hints, and post-game analysis. */
export const botClient = {
  move(fen: string, variant: VariantId, strength: BotId) {
    return engineClient.move(fen, variant, strength);
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
