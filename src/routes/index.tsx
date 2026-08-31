import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Shield, Swords, Users } from "lucide-react";
import { ChessMessMark } from "@/components/brand/ChessMessMark";
import { Button } from "@/components/ui/button";
import { VARIANTS } from "@/lib/chess/variants";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <p className="text-sm font-medium tracking-[0.18em] text-muted uppercase">
            ChessMess
          </p>
          <h1 className="font-display text-4xl leading-[1.1] text-fg sm:text-5xl">
            A court for every climate.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Play a bot that matches your strength. Keep a coach on your shoulder.
            Change the world — wood, ice, paper, royal — and the board, the pieces, and
            the sound change with it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/play">
                <Swords className="size-4" /> Play a bot
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/play" search={{ variant: "crazyhouse" }}>
                <Swords className="size-4" /> Crazyhouse
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/play" search={{ vs: "local" }}>
                <Users className="size-4" /> Challenge a friend
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/learn">
                <BookOpen className="size-4" /> Learn the pieces
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/fair-play">
                <Shield className="size-4" /> Fair Play
              </Link>
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-xs">
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface p-6">
            <ChessMessMark
              className="mx-auto aspect-square w-full max-w-[280px]"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Modes</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {VARIANTS.map((v) => (
            <Link
              key={v.id}
              to="/play"
              search={{ variant: v.id }}
              className="rounded-[var(--radius-md)] border border-border bg-surface p-3 hover:bg-elevated"
            >
              <div className="text-sm font-medium">{v.name}</div>
              <p className="mt-1 text-xs text-subtle">{v.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Fair Play</h2>
        <p className="text-sm text-muted">
          After a game, Stockfish reviews every move. High engine agreement at a human rating is
          flagged. A steward — not the engine — approves any suspension, or restores you.
        </p>
        <Button asChild variant="secondary">
          <Link to="/fair-play">Open the scanner</Link>
        </Button>
      </section>
    </div>
  );
}
