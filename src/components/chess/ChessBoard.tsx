import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  GameSnapshot,
  LastMove,
  Role,
  Side,
  SquareName,
} from "@/lib/chess/types";
import type { BoardStyleId } from "@/lib/chess/types";
import { useSettings } from "@/lib/store/settings";
import { themeById } from "@/lib/theme/themes";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";
import { type CaptureFxData, sqCenterPct } from "./captureFx";
import { ForestCaptureFx } from "./ForestCaptureFx";
import { IceCaptureFx } from "./IceCaptureFx";
import { MOVE_SLIDE_MS, type MoveSlideData } from "./movePacing";
import { NoirCaptureFx } from "./NoirCaptureFx";
import { OceanCaptureFx } from "./OceanCaptureFx";
import { PaperCaptureFx } from "./PaperCaptureFx";
import { RoyalCaptureFx } from "./RoyalCaptureFx";
import { WoodCaptureFx } from "./WoodCaptureFx";

export type { CaptureFxData };

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function isDarkSquare(sq: SquareName) {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  return (file + rank) % 2 === 0;
}

export function ChessBoard({
  snap,
  orientation,
  interactive,
  showCoords,
  markLastMove,
  highlightLegal,
  lastMoves,
  hint,
  selected,
  onSelect,
  onMove,
  onDrop,
  pendingDrop,
  shake,
  reviewSquares,
  captureFx,
  onCaptureFxDone,
  moveSlide,
}: {
  snap: GameSnapshot;
  orientation: Side;
  interactive: boolean;
  showCoords: boolean;
  markLastMove: boolean;
  highlightLegal: boolean;
  lastMoves: LastMove[];
  hint?: { from: SquareName; to: SquareName } | null;
  selected: SquareName | null;
  onSelect: (sq: SquareName | null) => void;
  onMove: (from: SquareName, to: SquareName) => void;
  onDrop?: (role: Role, to: SquareName) => void;
  pendingDrop?: Role | null;
  shake?: number;
  reviewSquares?: SquareName[];
  captureFx?: CaptureFxData | null;
  onCaptureFxDone?: () => void;
  moveSlide?: MoveSlideData | null;
}) {
  const [drag, setDrag] = useState<{
    sq: SquareName;
    x: number;
    y: number;
  } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const { theme, boardStyle, lockThemeAssets } = useSettings();
  const activeBoard: BoardStyleId = lockThemeAssets
    ? themeById(theme).defaultBoard
    : boardStyle;

  const grid = useMemo(() => {
    const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = orientation === "white" ? FILES : [...FILES].reverse();
    return ranks.flatMap((r) => files.map((f) => `${f}${r}` as SquareName));
  }, [orientation]);

  const bySq = useMemo(() => {
    const m = new Map<string, (typeof snap.pieces)[number]>();
    for (const p of snap.pieces) m.set(p.square, p);
    return m;
  }, [snap.pieces]);

  const lastSet = useMemo(() => {
    const s = new Set<string>();
    if (markLastMove) {
      for (const m of lastMoves) {
        if (m.from) s.add(m.from);
        s.add(m.to);
      }
    }
    return s;
  }, [lastMoves, markLastMove]);

  const legal = selected ? snap.legal[selected] ?? [] : pendingDrop ? snap.dropLegal[pendingDrop] ?? [] : [];
  const legalSet = new Set(legal);
  const checkKing = snap.inCheck
    ? snap.pieces.find((p) => p.role === "king" && p.color === snap.turn)?.square
    : undefined;

  const slideFrom = moveSlide ? sqCenterPct(moveSlide.from, orientation) : null;
  const slideTo = moveSlide ? sqCenterPct(moveSlide.to, orientation) : null;
  const [slideActive, setSlideActive] = useState(false);

  useEffect(() => {
    if (!moveSlide) {
      setSlideActive(false);
      return;
    }
    setSlideActive(false);
    const start = window.requestAnimationFrame(() => setSlideActive(true));
    return () => window.cancelAnimationFrame(start);
  }, [moveSlide?.from, moveSlide?.to, moveSlide?.role, moveSlide?.color]);

  function squareFromPoint(clientX: number, clientY: number): SquareName | null {
    const el = root.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || y < 0 || x > 1 || y > 1) return null;
    const file = Math.min(7, Math.max(0, Math.floor(x * 8)));
    const rank = Math.min(7, Math.max(0, Math.floor(y * 8)));
    const f = orientation === "white" ? file : 7 - file;
    const r = orientation === "white" ? 7 - rank : rank;
    return `${FILES[f]}${r + 1}` as SquareName;
  }

  function handleSquare(sq: SquareName) {
    if (!interactive) return;
    if (pendingDrop && onDrop) {
      onDrop(pendingDrop, sq);
      return;
    }
    const piece = bySq.get(sq);
    if (selected && legalSet.has(sq)) {
      onMove(selected, sq);
      return;
    }
    if (piece && piece.color === snap.turn) {
      onSelect(selected === sq ? null : sq);
      return;
    }
    onSelect(null);
  }

  return (
    <div
      ref={root}
      data-board={activeBoard}
      className="cm-board-frame relative aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] p-1.5 touch-none"
      style={{
        transform: shake ? `translate(${Math.sin(shake * 40) * 3}px, 0)` : undefined,
      }}
    >
      <div className="relative grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[calc(var(--radius-lg)-6px)]">
        {captureFx && onCaptureFxDone && (
          <>
            {activeBoard === "wood" && (
              <WoodCaptureFx
                fx={captureFx}
                orientation={orientation}
                onDone={onCaptureFxDone}
              />
            )}
            {activeBoard === "royal" && (
              <RoyalCaptureFx
                fx={captureFx}
                orientation={orientation}
                onDone={onCaptureFxDone}
              />
            )}
            {activeBoard === "ice" && (
              <IceCaptureFx
                fx={captureFx}
                orientation={orientation}
                onDone={onCaptureFxDone}
              />
            )}
            {activeBoard === "noir" && (
              <NoirCaptureFx
                fx={captureFx}
                orientation={orientation}
                onDone={onCaptureFxDone}
              />
            )}
            {activeBoard === "forest" && (
              <ForestCaptureFx
                fx={captureFx}
                orientation={orientation}
                onDone={onCaptureFxDone}
              />
            )}
            {activeBoard === "ocean" && (
              <OceanCaptureFx
                fx={captureFx}
                orientation={orientation}
                onDone={onCaptureFxDone}
              />
            )}
            {activeBoard === "paper" && (
              <PaperCaptureFx
                fx={captureFx}
                orientation={orientation}
                onDone={onCaptureFxDone}
              />
            )}
          </>
        )}
        {grid.map((sq, i) => {
          const file = sq.charCodeAt(0) - 97;
          const rank = Number(sq[1]) - 1;
          const dark = (file + rank) % 2 === 0;
          const isSel = selected === sq;
          const isLast = lastSet.has(sq);
          const isHint = hint && (hint.from === sq || hint.to === sq);
          const isReview = reviewSquares?.includes(sq);
          const piece = bySq.get(sq);
          const isLegal = highlightLegal && legalSet.has(sq);
          const isCapture = isLegal && piece;
          const dragging = drag?.sq === sq;
          return (
            <button
              key={sq}
              type="button"
              aria-label={sq}
              onClick={() => handleSquare(sq)}
              onPointerDown={(e) => {
                if (!interactive || !piece || piece.color !== snap.turn) return;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                onSelect(sq);
                setDrag({ sq, x: e.clientX, y: e.clientY });
              }}
              onPointerMove={(e) => {
                if (!drag) return;
                setDrag({ ...drag, x: e.clientX, y: e.clientY });
              }}
              onPointerUp={(e) => {
                if (!drag) return;
                const dest = squareFromPoint(e.clientX, e.clientY);
                setDrag(null);
                if (dest && dest !== drag.sq && (snap.legal[drag.sq] ?? []).includes(dest)) {
                  onMove(drag.sq, dest);
                }
              }}
              className={cn(
                "relative size-full",
                dark ? "cm-sq-dark" : "cm-sq-light",
              )}
            >
              {isLast && <span className="absolute inset-0" style={{ background: "var(--cm-last)" }} />}
              {isSel && <span className="absolute inset-0" style={{ background: "var(--cm-sel)" }} />}
              {isHint && (
                <span className="absolute inset-0 outline outline-2 -outline-offset-2 outline-accent/80" />
              )}
              {isReview && (
                <span className="absolute inset-0" style={{ background: "var(--cm-check)" }} />
              )}
              {checkKing === sq && (
                <span className="absolute inset-0" style={{ background: "var(--cm-check)" }} />
              )}
              {isLegal && !isCapture && (
                <span className="cm-legal-dot absolute top-1/2 left-1/2 size-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
              )}
              {isCapture && (
                <span className="cm-legal-ring absolute inset-[8%] rounded-full border-[3px]" />
              )}
              {piece && !dragging && !(moveSlide && moveSlide.to === sq) && (
                <span className="absolute inset-[6%]">
                  <PieceSvg role={piece.role} color={piece.color} />
                </span>
              )}
              {showCoords && i % 8 === 0 && (
                <span
                  className={cn(
                    "absolute top-0.5 left-1 text-[10px] font-medium",
                    dark ? "text-board-light/80" : "text-board-dark/80",
                  )}
                >
                  {sq[1]}
                </span>
              )}
              {showCoords && i >= 56 && (
                <span
                  className={cn(
                    "absolute right-1 bottom-0.5 text-[10px] font-medium",
                    dark ? "text-board-light/80" : "text-board-dark/80",
                  )}
                >
                  {sq[0]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {moveSlide && slideFrom && slideTo && (
        <div
          className={cn(
            "cm-move-slide-piece pointer-events-none absolute z-20 aspect-square -translate-x-1/2 -translate-y-1/2",
            slideActive && "cm-move-slide-piece--active",
          )}
          style={
            {
              width: "12.5%",
              "--from-x": `${slideFrom.x}%`,
              "--from-y": `${slideFrom.y}%`,
              "--to-x": `${slideTo.x}%`,
              "--to-y": `${slideTo.y}%`,
              left: slideActive ? `${slideTo.x}%` : `${slideFrom.x}%`,
              top: slideActive ? `${slideTo.y}%` : `${slideFrom.y}%`,
              transitionDuration: `${MOVE_SLIDE_MS}ms`,
            } as CSSProperties
          }
        >
          <PieceSvg role={moveSlide.role} color={moveSlide.color} />
        </div>
      )}
      {drag && bySq.get(drag.sq) && (
        <div
          className="pointer-events-none fixed z-50 size-[12vw] max-h-20 max-w-20 -translate-x-1/2 -translate-y-1/2"
          style={{ left: drag.x, top: drag.y }}
        >
          <PieceSvg
            role={bySq.get(drag.sq)!.role}
            color={bySq.get(drag.sq)!.color}
          />
        </div>
      )}
    </div>
  );
}
