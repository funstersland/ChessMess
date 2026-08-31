import { type ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Clock3, Scale, Settings, Shield, Swords, User } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { ChessMessMark } from "@/components/brand/ChessMessMark";
import { ThemePicker } from "@/components/layout/ThemePicker";
import { getFairPlayMe, type FairPlayMe } from "@/lib/server/fairplay";

const NAV = [
  { to: "/", label: "Play", icon: Swords, match: (p: string) => p === "/" || p.startsWith("/play") },
  { to: "/learn", label: "Learn", icon: BookOpen, match: (p: string) => p.startsWith("/learn") },
  { to: "/history", label: "Games", icon: Clock3, match: (p: string) => p.startsWith("/history") },
  { to: "/fair-play", label: "Fair", icon: Shield, match: (p: string) => p.startsWith("/fair-play") || p.startsWith("/admin") },
  { to: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const playing = path.startsWith("/play");
  const [fp, setFp] = useState<FairPlayMe | null>(null);

  useEffect(() => {
    if (!user) {
      setFp(null);
      return;
    }
    void getFairPlayMe()
      .then(setFp)
      .catch(() => setFp(null));
  }, [user, path]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <ChessMessMark size={36} className="rounded-[var(--radius-sm)]" />
            <span className="font-display text-lg tracking-tight text-fg">ChessMess</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-[var(--radius-sm)] px-3 py-2 text-sm",
                  n.match(path) ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemePicker />
            <Link
              to="/settings"
              className="inline-flex size-11 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-elevated hover:text-fg"
              aria-label="Settings"
            >
              <Settings className="size-4" />
            </Link>
            {fp?.isAdmin && (
              <Link
                to="/admin"
                className="inline-flex size-11 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-elevated hover:text-fg"
                aria-label="Steward desk"
              >
                <Scale className="size-4" />
              </Link>
            )}
            {isPending ? (
              <div className="size-9 animate-pulse rounded-full bg-elevated" />
            ) : (
              <>
                <SignedOut>
                  <Link
                    to="/login"
                    className="inline-flex h-11 items-center rounded-[var(--radius-md)] bg-accent px-4 text-sm font-medium text-accent-fg"
                  >
                    Sign in
                  </Link>
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </>
            )}
          </div>
        </div>
      </header>
      {fp && (fp.status === "suspended" || fp.status === "flagged") && !playing && (
        <div
          className={cn(
            "border-b px-4 py-2 text-center text-sm",
            fp.status === "suspended"
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-warn/30 bg-warn/10 text-warn",
          )}
        >
          {fp.status === "suspended" ? (
            <>
              Account suspended. Rated play is closed.{" "}
              <Link to="/fair-play" className="underline-offset-4 hover:underline">
                Fair Play
              </Link>
            </>
          ) : (
            <>
              A game is with the steward. You can still play.{" "}
              <Link to="/fair-play" className="underline-offset-4 hover:underline">
                See the scan
              </Link>
            </>
          )}
        </div>
      )}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-8">
        {children}
      </main>
      {!playing && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/90 backdrop-blur-md md:hidden">
          <div className="grid grid-cols-5">
            {NAV.map((n) => {
              const Icon = n.icon;
              const on = n.match(path);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                    on ? "text-fg" : "text-subtle",
                  )}
                >
                  <Icon className="size-5" />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
