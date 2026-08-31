import { cn } from "@/lib/utils";

export function EvalBar({
  cp,
  orientation,
}: {
  cp: number | null;
  orientation: "white" | "black";
}) {
  if (cp == null) return null;
  const clamped = Math.max(-800, Math.min(800, cp));
  const whitePct = 50 + (clamped / 800) * 50;
  const whiteOnBottom = orientation === "white";
  const label =
    Math.abs(cp) > 20000 ? (cp > 0 ? "M" : "-M") : (cp / 100).toFixed(1);
  return (
    <div className="relative h-full w-3 overflow-hidden rounded-full bg-piece-b">
      <div
        className={cn("absolute start-0 w-full bg-piece-w", whiteOnBottom ? "bottom-0" : "top-0")}
        style={{ height: `${whiteOnBottom ? whitePct : 100 - whitePct}%` }}
      />
      <span className="sr-only">Eval {label}</span>
    </div>
  );
}
