import type { Role, Side } from "@/lib/chess/types";
import { pieceCode, pieceUrl, type PieceSetId } from "@/lib/chess/pieceSets";
import { cn } from "@/lib/utils";
import { useActivePieceSet } from "./appearance";
import { CLASSIC_PIECES } from "./classic-pieces";

/**
 * One chess piece. Uses the player's piece set unless `set` is given (for
 * previews). Image sets render an <img>; the ChessMess set is drawn inline.
 */
export function PieceSvg({
  role,
  color,
  className,
  set,
}: {
  role: Role;
  color: Side;
  className?: string;
  set?: PieceSetId;
}) {
  const active = useActivePieceSet();
  const id = set ?? active;
  if (id === "chessmess") {
    return <ChessMessPiece role={role} color={color} className={className} />;
  }
  return (
    <img
      src={pieceUrl(id, color, role)}
      alt=""
      aria-hidden
      draggable={false}
      data-piece={pieceCode(color, role)}
      className={cn("cm-piece cm-piece-img", className)}
    />
  );
}

/*
 * The original ChessMess artwork. Its paths were drawn for a 45×45 box but
 * the rook and knight reach x≈51, so each role gets its own 48-unit viewBox
 * centred on its outline: nothing is clipped and every piece is centred.
 */
const CENTER_X: Record<Role, number> = {
  king: 26.75,
  queen: 22.35,
  rook: 30.5,
  bishop: 26.4,
  knight: 30.8,
  pawn: 22.5,
};

function ChessMessPiece({
  role,
  color,
  className,
}: {
  role: Role;
  color: Side;
  className?: string;
}) {
  const art = CLASSIC_PIECES[role];
  // White: white body, black outline and details.
  // Black: solid black body and outline with white details, so black pieces
  // (pawns especially) read as black at a glance instead of as outlines.
  const fill = color === "white" ? "#ffffff" : "#141414";
  const outline = "#141414";
  const detail = color === "white" ? "#141414" : "#f2f2f2";
  const minX = CENTER_X[role] - 24;

  return (
    <svg
      viewBox={`${minX} -2.5 48 48`}
      className={cn("cm-piece h-full w-full", className)}
      data-piece={pieceCode(color, role)}
      aria-hidden
    >
      {art.fills.map((d, i) => (
        <path
          key={`f-${i}`}
          d={d}
          fill={fill}
          stroke={outline}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {art.lines.map((d, i) => (
        <path
          key={`l-${i}`}
          d={d}
          fill="none"
          stroke={detail}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
      {art.dots.map((dot, i) => (
        <circle key={`d-${i}`} cx={dot.cx} cy={dot.cy} r={dot.r} fill={detail} />
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
