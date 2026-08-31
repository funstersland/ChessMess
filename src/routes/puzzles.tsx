import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Flame } from "lucide-react";
import { DAILY_PUZZLE, PUZZLES } from "@/lib/learn/puzzles";
import { isPuzzleDone, puzzleStreak } from "@/lib/learn/progress";

export const Route = createFileRoute("/puzzles")({ component: PuzzlesIndex });

function PuzzlesIndex() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setDone(new Set(PUZZLES.filter((p) => isPuzzleDone(p.id)).map((p) => p.id)));
    setStreak(puzzleStreak());
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Puzzles</h1>
        <p className="mt-2 max-w-xl text-muted">
          Verified tactics — each position has one correct answer checked on the board.
        </p>
      </div>

      <Link
        to="/puzzles/$id"
        params={{ id: DAILY_PUZZLE.id }}
        className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-accent/30 bg-accent/10 p-4 hover:bg-accent/15"
      >
        <Flame className="size-8 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">Daily puzzle</div>
          <p className="text-sm text-muted">{DAILY_PUZZLE.title} · {DAILY_PUZZLE.theme}</p>
        </div>
        {isPuzzleDone(DAILY_PUZZLE.id) && <Check className="size-5 text-good" />}
      </Link>

      {streak > 0 && (
        <p className="text-sm text-muted">{streak} puzzle{streak === 1 ? "" : "s"} solved on this device.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {PUZZLES.map((p) => (
          <Link
            key={p.id}
            to="/puzzles/$id"
            params={{ id: p.id }}
            className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface p-4 hover:bg-elevated"
          >
            <div>
              <div className="font-medium">{p.title}</div>
              <p className="text-sm text-muted">
                {p.theme} · ~{p.rating}
              </p>
            </div>
            {done.has(p.id) && <Check className="size-5 shrink-0 text-good" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
