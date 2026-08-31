import type { Role, Side } from "@/lib/chess/types";
import type { Pocket } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";

const POCKET_ROLES: Role[] = ["queen", "rook", "bishop", "knight", "pawn"];

export function PocketBar({
  pocket,
  side,
  label,
  canUse,
  pendingDrop,
  onPick,
}: {
  pocket: Pocket;
  side: Side;
  label: string;
  canUse: boolean;
  pendingDrop: Role | null;
  onPick: (role: Role | null) => void;
}) {
  const entries = POCKET_ROLES.flatMap((role) => {
    const n = pocket[side][role] ?? 0;
    return n > 0 ? [{ role, n }] : [];
  });
  if (!entries.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 gap-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(({ role, n }) => (
          <button
            key={role}
            type="button"
            disabled={!canUse}
            onClick={() => onPick(pendingDrop === role ? null : role)}
            className={cn(
              "flex h-11 items-center gap-1 rounded-[var(--radius-sm)] border border-border px-2 transition-colors",
              canUse && "hover:bg-elevated",
              pendingDrop === role && canUse && "border-accent bg-elevated ring-1 ring-accent/40",
              !canUse && "opacity-70",
            )}
            aria-pressed={pendingDrop === role}
            aria-label={`${n} ${role}${n > 1 ? "s" : ""} in hand`}
          >
            <span className="size-6">
              <PieceSvg role={role} color={side} />
            </span>
            <span className="min-w-[1ch] text-xs font-medium tabular-nums">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
