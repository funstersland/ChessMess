export type CoachGender = "female" | "male";

const LINES = {
  greeting: [
    "I'm with you. Play the board in front of you — not the one in your head.",
    "Breathe. One good move at a time.",
  ],
  check: [
    "Check. The king must step or you must cover.",
    "You're in check. Look at every flight square.",
  ],
  capture: ["Nice take. Recapture? Count the defenders.", "Material changed. Recalculate."],
  blunder: [
    "That hangs material. Look at the square you just left.",
    "Blunder. The piece can be taken — take a breath, we'll recover.",
  ],
  mistake: [
    "A slip. There's a stronger idea here.",
    "Not losing yet — but that wasn't the best.",
  ],
  great: ["That's the move. Clean.", "Yes. That's the idea."],
  opening: [
    "Develop. Control the centre. King safety before heroics.",
    "Knights before bishops. Don't move the same piece twice.",
  ],
  endgame: ["Activate the king. It's a fighting piece now.", "Passed pawns want to run."],
  mate: ["Checkmate. The king has nowhere."],
  lose: ["Tough one. The review will show the turning point."],
  hint: ["I'll point at a candidate. You decide if it's yours."],
};

function pick(list: string[]) {
  return list[Math.floor(Math.random() * list.length)]!;
}

export function coachLine(
  kind: keyof typeof LINES,
  extra?: string,
): string {
  const base = pick(LINES[kind]);
  return extra ? `${base} ${extra}` : base;
}

export function speak(text: string, opts: {
  gender: CoachGender;
  volume: number;
  rate: number;
  enabled: boolean;
}) {
  if (!opts.enabled || typeof window === "undefined") return;
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const prefer =
    opts.gender === "female"
      ? voices.find((v) => /female|samantha|victoria|zira|google uk english female/i.test(v.name))
      : voices.find((v) => /male|daniel|david|alex|google uk english male/i.test(v.name));
  const fallback =
    opts.gender === "female"
      ? voices.find((v) => v.lang.startsWith("en") && !/male/i.test(v.name))
      : voices.find((v) => v.lang.startsWith("en"));
  u.voice = prefer ?? fallback ?? voices[0] ?? null;
  u.rate = opts.rate;
  u.pitch = opts.gender === "female" ? 1.12 : 0.86;
  u.volume = Math.max(0, Math.min(1, opts.volume));
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

export function explainMistake(opts: {
  san: string;
  bestSan?: string;
  classification: string;
}): string {
  if (opts.classification === "blunder") {
    return opts.bestSan
      ? `Blunder with ${opts.san}. ${opts.bestSan} holds the position.`
      : `Blunder with ${opts.san}. Look for the hanging piece.`;
  }
  if (opts.classification === "mistake") {
    return opts.bestSan
      ? `${opts.san} is a mistake. Consider ${opts.bestSan}.`
      : `${opts.san} gives up too much.`;
  }
  return opts.bestSan
    ? `A better try was ${opts.bestSan}.`
    : `There's a cleaner continuation.`;
}

/** Spoken guidance after each player move in coach mode. */
export function coachMoveGuidance(opts: {
  ply: number;
  san: string;
  inCheck: boolean;
  classification?: string;
  bestSan?: string;
  cpLoss?: number;
}): string {
  if (opts.inCheck) return coachLine("check");
  if (opts.classification === "blunder" || opts.classification === "mistake") {
    return explainMistake({
      san: opts.san,
      bestSan: opts.bestSan,
      classification: opts.classification,
    });
  }
  if (opts.classification === "great" || (opts.cpLoss != null && opts.cpLoss < 20)) {
    return `${coachLine("great")} ${opts.san} is on the mark.`;
  }
  if (opts.ply <= 14) {
    return `${coachLine("opening")} You played ${opts.san}.`;
  }
  if (opts.ply >= 40) {
    return `${coachLine("endgame")} ${opts.san} keeps the fight going.`;
  }
  if (opts.bestSan && opts.bestSan !== opts.san) {
    return `${opts.san} is fine. I also like ${opts.bestSan}.`;
  }
  return `Good — ${opts.san}. Stay alert for the reply.`;
}
