import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  BookOpen,
  Calendar,
  ChevronRight,
  Cpu,
  Dumbbell,
  FolderOpen,
  Grid3x3,
  Lightbulb,
  Puzzle,
  Swords,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DAILY_PUZZLE } from "@/lib/learn/puzzles";

type Item = { to: string; label: string; icon: LucideIcon; search?: Record<string, string> };
type Section = { id: string; label: string; icon: LucideIcon; items: Item[]; match: (p: string) => boolean };

export const NAV_SECTIONS: Section[] = [
  {
    id: "play",
    label: "Play",
    icon: Swords,
    match: (p) => p === "/" || p.startsWith("/play") || p.startsWith("/variants") || p.startsWith("/stats"),
    items: [
      { to: "/play", label: "Play bots", icon: Bot },
      { to: "/play", label: "Pass & play", icon: Users, search: { vs: "local" } },
      { to: "/play", label: "Play online", icon: Cpu, search: { vs: "online" } },
      { to: "/stats", label: "Stats", icon: BarChart3 },
      { to: "/variants", label: "Variants", icon: Grid3x3 },
      { to: "/history", label: "Game history", icon: FolderOpen },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    icon: BookOpen,
    match: (p) => p.startsWith("/learn") || p.startsWith("/puzzles"),
    items: [
      { to: "/learn", label: "Lessons", icon: BookOpen },
      { to: "/puzzles", label: "Puzzles", icon: Puzzle },
      { to: "/puzzles/$id", label: "Daily puzzle", icon: Calendar },
    ],
  },
  {
    id: "train",
    label: "Train",
    icon: Dumbbell,
    match: (p) => p.startsWith("/analysis") || p.startsWith("/fair-play"),
    items: [
      { to: "/analysis", label: "Analysis board", icon: Lightbulb },
      { to: "/fair-play", label: "Fair Play scan", icon: Swords },
    ],
  },
];

const MOBILE_NAV = [
  { to: "/", label: "Play", icon: Swords, match: NAV_SECTIONS[0]!.match },
  { to: "/learn", label: "Learn", icon: BookOpen, match: NAV_SECTIONS[1]!.match },
  { to: "/history", label: "Games", icon: FolderOpen, match: (p: string) => p.startsWith("/history") },
  { to: "/fair-play", label: "Fair", icon: Swords, match: (p: string) => p.startsWith("/fair-play") || p.startsWith("/admin") },
  { to: "/profile", label: "Profile", icon: Users, match: (p: string) => p.startsWith("/profile") },
];

export function NavMegaMenu({ path }: { path: string }) {
  return (
    <nav className="ml-4 hidden items-center gap-1 md:flex">
      {NAV_SECTIONS.map((section) => {
        const Icon = section.icon;
        const active = section.match(path);
        return (
          <div key={section.id} className="group relative">
            <Link
              to={section.items[0]!.to}
              search={section.items[0]!.search}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm",
                active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" />
              {section.label}
            </Link>
            <div className="pointer-events-none invisible absolute top-full left-0 z-[100] pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100">
              <div className="min-w-[14rem] rounded-[var(--radius-lg)] border border-border bg-bg p-2 shadow-xl">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  const params =
                    item.to === "/puzzles/$id" ? { id: DAILY_PUZZLE.id } : undefined;
                  return (
                    <Link
                      key={item.label}
                      to={item.to as "/play"}
                      params={params}
                      search={item.search}
                      className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm text-fg hover:bg-elevated"
                    >
                      <ItemIcon className="size-4 text-muted" />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="size-3 text-subtle" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
      <Link
        to="/history"
        className={cn(
          "rounded-[var(--radius-sm)] px-3 py-2 text-sm",
          path.startsWith("/history") ? "bg-elevated text-fg" : "text-muted hover:text-fg",
        )}
      >
        Games
      </Link>
      <Link
        to="/profile"
        className={cn(
          "rounded-[var(--radius-sm)] px-3 py-2 text-sm",
          path.startsWith("/profile") ? "bg-elevated text-fg" : "text-muted hover:text-fg",
        )}
      >
        Profile
      </Link>
    </nav>
  );
}

export { MOBILE_NAV };
