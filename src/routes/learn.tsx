import { createFileRoute, Link } from "@tanstack/react-router";
import { LESSONS } from "@/lib/learn/lessons";

export const Route = createFileRoute("/learn")({ component: LearnIndex });

function LearnIndex() {
  const chapters = [...new Set(LESSONS.map((l) => l.chapter))];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">The course</h1>
        <p className="mt-2 max-w-xl text-muted">
          A beginner path: how each piece moves, the special rules, how games
          end, and the first ideas of real play. The coach talks you through it.
        </p>
      </div>
      {chapters.map((ch) => (
        <section key={ch} className="space-y-3">
          <h2 className="text-sm font-medium tracking-wide text-muted uppercase">{ch}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {LESSONS.filter((l) => l.chapter === ch).map((l) => (
              <Link
                key={l.id}
                to="/learn/$id"
                params={{ id: l.id }}
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 hover:bg-elevated"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{l.title}</span>
                  <span className="text-xs text-subtle">{l.minutes} min</span>
                </div>
                <p className="mt-1 text-sm text-muted">{l.steps[0]?.body.slice(0, 90)}…</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
