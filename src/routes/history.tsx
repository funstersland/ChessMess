import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyGames } from "@/lib/server/profile";
import { downloadPgn } from "@/lib/chess/engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listMyGames>>>([]);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!user) return;
    void listMyGames()
      .then(setRows)
      .catch(() => setErr(true));
  }, [user]);

  if (isPending) return <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-elevated" />;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Games</h1>
        <p className="mt-1 text-muted">Rated games stored to your account. Scan any of them with Stockfish.</p>
      </div>
      {err && <p className="text-sm text-danger">Could not load games.</p>}
      {rows.length === 0 && !err && (
        <p className="text-muted">
          No games yet. <Link to="/play" className="underline-offset-4 hover:underline">Play a bot</Link>.
        </p>
      )}
      <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
        {rows.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Badge
              tone={g.result === "win" ? "good" : g.result === "loss" ? "danger" : "muted"}
            >
              {g.result}
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                vs {g.opponent} · {g.variant}
              </div>
              <div className="text-xs text-subtle">
                {g.color} · {g.time_control} · {g.rating_before} → {g.rating_after}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadPgn(g.pgn, `chessmess-${g.id.slice(0, 8)}.pgn`)}
            >
              PGN
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link to="/fair-play" search={{ game: g.id }}>
                Scan
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
