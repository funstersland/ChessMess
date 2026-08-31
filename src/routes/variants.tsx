import { createFileRoute, Link } from "@tanstack/react-router";
import { VARIANTS } from "@/lib/chess/variants";

export const Route = createFileRoute("/variants")({ component: VariantsPage });

function VariantsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Variants</h1>
        <p className="mt-2 max-w-xl text-muted">
          Every mode here is fully playable — pick one and start a game against a bot, a friend
          on the same screen, or online.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {VARIANTS.map((v) => (
          <Link
            key={v.id}
            to="/play"
            search={{ variant: v.id }}
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 hover:bg-elevated"
          >
            <div className="font-medium">{v.name}</div>
            <p className="mt-1 text-sm text-muted">{v.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
