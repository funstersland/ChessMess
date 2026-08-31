import type { ScanMetrics, Verdict } from "./types";

/** Typical engine-match rate for a human at this rating. */
export function expectedTop1(rating: number): number {
  const r = Math.max(400, Math.min(3200, rating));
  return 0.2 + 0.55 / (1 + Math.exp(-(r - 2050) / 280));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function ratio(hits: number, n: number) {
  return n <= 0 ? 0 : hits / n;
}

export function summarizeEngine(
  id: import("./types").EngineId,
  name: string,
  matches: Array<0 | 1 | 2 | 3>,
  cpls: number[],
  ready: boolean,
  error?: string,
) {
  const n = matches.length;
  const top1 = ratio(matches.filter((m) => m === 1).length, n);
  const top3 = ratio(matches.filter((m) => m >= 1).length, n);
  const acpl =
    cpls.length === 0
      ? 0
      : cpls.reduce((a, b) => a + b, 0) / cpls.length;
  return {
    id,
    name,
    ready,
    top1,
    top3,
    acpl,
    error,
  };
}

export function accuracyFromAcpl(acpl: number): number {
  return clamp(100 * Math.exp(-0.0043 * acpl), 0, 100);
}

export function longestTop1Streak(matches: Array<0 | 1 | 2 | 3>): number {
  let best = 0;
  let run = 0;
  for (const m of matches) {
    if (m === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

export function riskFromMetrics(m: ScanMetrics, rating: number): {
  risk: number;
  verdict: Verdict;
} {
  if (m.considered < 6) {
    return { risk: 0, verdict: "insufficient" };
  }

  const expect = expectedTop1(rating);
  const sf = m.stockfish;
  const excess = Math.max(0, sf.top1 - expect);

  let risk = excess * 155;
  if (sf.acpl < 28) risk += (28 - sf.acpl) * 1.05;
  if (sf.top1 >= 0.72 && m.considered >= 8) risk += 12;
  if (sf.top1 >= 0.82 && m.considered >= 8) risk += 14;
  if ((m.streak ?? 0) >= 8) risk += 10;
  if ((m.streak ?? 0) >= 12) risk += 8;
  if (sf.acpl > 90) risk -= 22;
  if (sf.top1 < expect + 0.06) risk *= 0.45;
  if (!m.stockfish.ready) risk *= 0.82;

  risk = Math.round(clamp(risk, 0, 100));

  let verdict: Verdict = "clean";
  if (risk >= 85) verdict = "severe";
  else if (risk >= 70) verdict = "flag";
  else if (risk >= 50) verdict = "watch";

  return { risk, verdict };
}

export function verdictLabel(v: Verdict): string {
  switch (v) {
    case "insufficient":
      return "Too short";
    case "clean":
      return "Clean";
    case "watch":
      return "Watch";
    case "flag":
      return "Flagged";
    case "severe":
      return "Severe";
  }
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
