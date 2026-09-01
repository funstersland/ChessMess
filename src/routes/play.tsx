import { createFileRoute } from "@tanstack/react-router";
import { PlayArena, type MatchConfig } from "@/components/chess/PlayArena";
import type { BotId, OpponentKind, VariantId } from "@/lib/chess/types";

type PlaySearch = {
  bot?: string;
  variant?: string;
  vs?: string;
  room?: string;
};

export const Route = createFileRoute("/play")({
  validateSearch: (s: Record<string, unknown>): PlaySearch => ({
    bot: typeof s.bot === "string" ? s.bot : undefined,
    variant: typeof s.variant === "string" ? s.variant : undefined,
    vs: typeof s.vs === "string" ? s.vs : undefined,
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  component: PlayPage,
});

function PlayPage() {
  const search = Route.useSearch();
  const vs = search.vs;
  const opponent: OpponentKind =
    vs === "local"
      ? "local"
      : vs === "coach"
        ? "coach"
        : vs === "online" || search.room
          ? "online"
          : "bot";
  const room = search.room ? search.room.replace(/\D/g, "").slice(0, 6) : undefined;
  const initial: Partial<MatchConfig> = {
    bot: (search.bot as BotId) || undefined,
    variant: (search.variant as VariantId) || undefined,
    opponent,
    room,
    onlineMode: room ? "join" : "create",
  };
  return <PlayArena key={`${opponent}-${search.room ?? ""}-${search.bot ?? ""}-${search.variant ?? ""}`} initial={initial} />;
}
