import type { PlayedMove } from "@/lib/chess/types";
import { cn } from "@/lib/utils";

export function MoveList({
  moves,
  ply,
  onPly,
}: {
  moves: PlayedMove[];
  ply?: number;
  onPly?: (i: number) => void;
}) {
  const rows: { n: number; w?: PlayedMove; b?: PlayedMove; wi: number; bi?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      n: Math.floor(i / 2) + 1,
      w: moves[i],
      b: moves[i + 1],
      wi: i,
      bi: i + 1 < moves.length ? i + 1 : undefined,
    });
  }
  return (
    <div className="max-h-64 overflow-auto rounded-[var(--radius-md)] border border-border bg-elevated/60 text-sm">
      {rows.length === 0 && (
        <p className="px-3 py-4 text-subtle">No moves yet.</p>
      )}
      {rows.map((row) => (
        <div key={row.n} className="grid grid-cols-[2.2rem_1fr_1fr] items-center border-b border-border/60 last:border-0">
          <span className="px-2 py-1.5 text-subtle tabular-nums">{row.n}</span>
          <button
            type="button"
            className={cn(
              "px-2 py-1.5 text-left",
              ply === row.wi && "bg-accent text-accent-fg",
            )}
            onClick={() => onPly?.(row.wi)}
          >
            {row.w?.san}
          </button>
          <button
            type="button"
            className={cn(
              "px-2 py-1.5 text-left",
              row.bi != null && ply === row.bi && "bg-accent text-accent-fg",
            )}
            onClick={() => row.bi != null && onPly?.(row.bi)}
          >
            {row.b?.san ?? ""}
          </button>
        </div>
      ))}
    </div>
  );
}
