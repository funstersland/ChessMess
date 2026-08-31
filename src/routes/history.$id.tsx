import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { GameReview } from "@/components/chess/GameReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseGamePgn, replayUcis } from "@/lib/fairplay/pgn";
import { getMyGame } from "@/lib/server/profile";
import type { VariantId } from "@/lib/chess/types";

export const Route = createFileRoute("/history/$id")({ component: ReplayPage });

function ReplayPage() {
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [game, setGame] = useState<Awaited<ReturnType<typeof getMyGame>> | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getMyGame({ data: { id } })
      .then(setGame)
      .catch(() => setErr(true));
  }, [user, id]);

  const moves = useMemo(() => {
    if (!game) return [];
    const variant = game.variant as VariantId;
    if (game.ucis.length > 0) {
      try {
        return replayUcis(game.fen_start, game.ucis, variant).moves;
      } catch {
        /* fall through to PGN */
      }
    }
    try {
      return parseGamePgn(game.pgn).moves;
    } catch {
      return [];
    }
  }, [game]);

  if (isPending) return <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-elevated" />;
  if (!user) return <RedirectToSignIn />;
  if (err || !game) {
    return (
      <p className="text-muted">
        Game not found. <Link to="/history">Back to games</Link>.
      </p>
    );
  }
  if (moves.length === 0) {
    return (
      <p className="text-muted">
        Could not replay this game. <Link to="/history">Back</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Game replay</h1>
          <p className="mt-1 text-muted">
            vs {game.opponent} · {game.variant} · {game.time_control}
          </p>
        </div>
        <Badge tone={game.result === "win" ? "good" : game.result === "loss" ? "danger" : "muted"}>
          {game.result} · {game.rating_before} → {game.rating_after}
        </Badge>
      </div>
      <GameReview
        fenStart={game.fen_start}
        moves={moves}
        variant={game.variant as VariantId}
        white={game.color === "white" ? "You" : game.opponent}
        black={game.color === "black" ? "You" : game.opponent}
        result={game.result}
        analysis={game.analysis}
        orientation={game.color as "white" | "black"}
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link to="/fair-play" search={{ game: game.id }}>
            Fair Play scan
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/history">All games</Link>
        </Button>
      </div>
    </div>
  );
}
