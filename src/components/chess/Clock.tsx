import { cn } from "@/lib/utils";

export function formatMs(ms: number): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function Clock({
  ms,
  active,
  flagged,
  label,
}: {
  ms: number | null;
  active: boolean;
  flagged?: boolean;
  label: string;
}) {
  if (ms == null) {
    return (
      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-elevated px-3 py-2">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-sm text-subtle">∞</span>
      </div>
    );
  }
  const low = ms < 20000;
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2 tabular-nums",
        active ? "border-accent bg-accent text-accent-fg" : "border-border bg-elevated text-fg",
        flagged && "border-danger bg-danger/20 text-danger",
      )}
    >
      <span className="text-sm opacity-80">{label}</span>
      <span className={cn("font-display text-xl", low && !flagged && "text-danger")}>
        {formatMs(ms)}
      </span>
    </div>
  );
}
