import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Badge } from "@/components/ui/badge";
import { getMyProfile, listMyGames } from "@/lib/server/profile";
import { VARIANTS } from "@/lib/chess/variants";
import { puzzleStreak, isLessonDone } from "@/lib/learn/progress";
import { LESSONS } from "@/lib/learn/lessons";

export const Route = createFileRoute("/stats")({ component: StatsPage });

function StatsPage() {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getMyProfile>> | null>(null);
  const [games, setGames] = useState<Awaited<ReturnType<typeof listMyGames>>>([]);

  useEffect(() => {
    if (!user) return;
    void getMyProfile().then(setProfile).catch(() => {});
    void listMyGames().then(setGames).catch(() => {});
  }, [user]);

  const byVariant = useMemo(() => {
    const m = new Map<string, { w: number; d: number; l: number }>();
    for (const g of games) {
      const row = m.get(g.variant) ?? { w: 0, d: 0, l: 0 };
      if (g.result === "win") row.w += 1;
      else if (g.result === "draw") row.d += 1;
      else row.l += 1;
      m.set(g.variant, row);
    }
    return [...m.entries()].sort((a, b) => b[1].w + b[1].d + b[1].l - (a[1].w + a[1].d + a[1].l));
  }, [games]);

  const lessonsDone = LESSONS.filter((l) => isLessonDone(l.id)).length;

  if (isPending) return <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-elevated" />;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Stats</h1>
        <p className="mt-2 text-muted">Your rated record and training progress on this device.</p>
      </div>

      {profile && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Rating" value={String(profile.rating)} sub={`Peak ${profile.peak_rating}`} />
          <StatCard
            label="Record"
            value={`${profile.wins}W ${profile.draws}D ${profile.losses}L`}
            sub={`${games.length} saved games`}
          />
          <StatCard label="Lessons" value={`${lessonsDone}/${LESSONS.length}`} sub="On this device" />
          <StatCard label="Puzzles" value={String(puzzleStreak())} sub="Solved locally" />
        </div>
      )}

      {byVariant.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">By variant</h2>
          <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
            {byVariant.map(([id, r]) => {
              const v = VARIANTS.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium">{v?.name ?? id}</span>
                  <Badge tone="muted">
                    {r.w}W {r.d}D {r.l}L
                  </Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted">
        <Link to="/history" className="underline-offset-4 hover:underline">
          View game history
        </Link>{" "}
        ·{" "}
        <Link to="/analysis" className="underline-offset-4 hover:underline">
          Analysis board
        </Link>
      </p>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <p className="text-xs tracking-wide text-subtle uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{sub}</p>
    </div>
  );
}
