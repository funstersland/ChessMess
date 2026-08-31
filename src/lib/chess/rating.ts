export function expectedScore(rating: number, opp: number): number {
  return 1 / (1 + 10 ** ((opp - rating) / 400));
}

export function kFactor(rating: number, games: number): number {
  if (games < 20) return 40;
  if (rating < 1500) return 32;
  if (rating < 2000) return 24;
  return 16;
}

/** score: 1 win, 0.5 draw, 0 loss */
export function nextRating(
  rating: number,
  opp: number,
  score: number,
  games: number,
): { next: number; delta: number } {
  const k = kFactor(rating, games);
  const delta = Math.round(k * (score - expectedScore(rating, opp)));
  return { next: Math.max(100, rating + delta), delta };
}

export function classifyCpLoss(loss: number): import("./types").MoveClass {
  const x = Math.abs(loss);
  if (x < 20) return "great";
  if (x < 50) return "good";
  if (x < 100) return "inaccuracy";
  if (x < 200) return "mistake";
  return "blunder";
}

export function classLabel(c: import("./types").MoveClass): string {
  switch (c) {
    case "brilliant":
      return "Brilliant";
    case "great":
      return "Great";
    case "good":
      return "Good";
    case "inaccuracy":
      return "Inaccuracy";
    case "mistake":
      return "Mistake";
    case "blunder":
      return "Blunder";
  }
}
