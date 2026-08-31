import type { Role, Side } from "@/lib/chess/types";
import { PieceSvg } from "./PieceSvg";

const ORDER: Role[] = ["queen", "rook", "bishop", "knight", "pawn"];

export function Captured({
  pieces,
  color,
  advantage,
}: {
  pieces: Role[];
  color: Side;
  advantage?: number;
}) {
  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-0.5">
      {sorted.map((role, i) => (
        <span key={`${role}-${i}`} className="size-5">
          <PieceSvg role={role} color={color} />
        </span>
      ))}
      {advantage != null && advantage > 0 && (
        <span className="ml-1 text-xs text-muted tabular-nums">+{advantage}</span>
      )}
    </div>
  );
}
