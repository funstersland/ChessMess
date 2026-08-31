import type { Role, Side } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { CLASSIC_PIECES } from "./classic-pieces";

/** Universal piece colors — same on every board and theme. */
const PIECE_FILL = {
  white: "#ffffff",
  black: "#111111",
} as const;

const PIECE_STROKE = {
  white: "#111111",
  black: "#ffffff",
} as const;

export function PieceSvg({
  role,
  color,
  className,
}: {
  role: Role;
  color: Side;
  className?: string;
}) {
  const art = CLASSIC_PIECES[role];
  const fill = PIECE_FILL[color];
  const stroke = PIECE_STROKE[color];
  const fillStroke = 2.2;
  const lineStroke = 1.6;

  return (
    <svg
      viewBox="0 0 45 45"
      className={cn("cm-piece h-full w-full", className)}
      aria-hidden
    >
      {art.fills.map((d, i) => (
        <path
          key={`f-${i}`}
          d={d}
          fill={fill}
          stroke={stroke}
          strokeWidth={fillStroke}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {art.lines.map((d, i) => (
        <path
          key={`l-${i}`}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={lineStroke}
          strokeLinecap="round"
        />
      ))}
      {art.dots.map((dot, i) => (
        <circle key={`d-${i}`} cx={dot.cx} cy={dot.cy} r={dot.r} fill={stroke} />
      ))}
    </svg>
  );
}

export const ROLE_LETTER: Record<Role, string> = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: "P",
};
