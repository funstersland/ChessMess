import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Side, SquareName } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";
import { type CaptureFxData, sqCenterPct } from "./captureFx";

function WoodAxe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-full drop-shadow-md", className)} aria-hidden>
      <path
        d="M16 2 L18 14 L26 16 L18 18 L16 30 L14 18 L6 16 L14 14 Z"
        fill="#8b6914"
        stroke="#5a4010"
        strokeWidth="0.8"
      />
      <path d="M14 14 L18 14 L17 22 L15 22 Z" fill="#c8a860" />
      <path d="M8 15 L24 15 L23 17 L9 17 Z" fill="#d4d0c8" stroke="#888" strokeWidth="0.5" />
      <path d="M22 13 L28 16 L22 19 Z" fill="#b8b8b8" stroke="#666" strokeWidth="0.6" />
    </svg>
  );
}

export function WoodCaptureFx({
  fx,
  orientation,
  onDone,
}: {
  fx: CaptureFxData;
  orientation: Side;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"swing" | "hit" | "shatter">("swing");
  const from = sqCenterPct(fx.from, orientation);
  const to = sqCenterPct(fx.to, orientation);

  const chips = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        angle: (i / 12) * 360 + (i % 3) * 11,
        dist: 18 + (i % 4) * 8,
        w: 4 + (i % 3) * 2,
        h: 2 + (i % 2),
        delay: i * 18,
      })),
    [fx.from, fx.to],
  );

  useEffect(() => {
    setPhase("swing");
    const t1 = window.setTimeout(() => setPhase("hit"), 340);
    const t2 = window.setTimeout(() => setPhase("shatter"), 460);
    const t3 = window.setTimeout(() => onDone(), 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fx.from, fx.to, fx.victim.role, fx.victim.color, onDone]);

  const axeDx = to.x - from.x;
  const axeDy = to.y - from.y;

  return (
    <div className="cm-wood-capture-fx pointer-events-none absolute inset-0 z-30" aria-hidden>
      <div
        className={cn("cm-wood-axe absolute", phase === "swing" && "cm-wood-axe--swing")}
        style={
          {
            left: `${from.x}%`,
            top: `${from.y}%`,
            width: "11%",
            "--axe-dx": `${axeDx}%`,
            "--axe-dy": `${axeDy}%`,
          } as CSSProperties
        }
      >
        <WoodAxe />
      </div>

      {phase !== "swing" && (
        <div
          className={cn(
            "cm-wood-victim absolute aspect-square -translate-x-1/2 -translate-y-1/2",
            phase === "hit" && "cm-wood-victim--hit",
            phase === "shatter" && "cm-wood-victim--shatter",
          )}
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "12.5%" }}
        >
          <PieceSvg role={fx.victim.role} color={fx.victim.color} />
        </div>
      )}

      {phase === "shatter" && (
        <div
          className="cm-wood-chips absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "12.5%", height: "12.5%" }}
        >
          {chips.map((c) => (
            <span
              key={c.id}
              className="cm-wood-chip absolute left-1/2 top-1/2"
              style={
                {
                  width: `${c.w}px`,
                  height: `${c.h}px`,
                  "--chip-angle": `${c.angle}deg`,
                  "--chip-dist": `${c.dist}px`,
                  animationDelay: `${c.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {phase === "hit" && (
        <span
          className="cm-wood-impact absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%` }}
        />
      )}
    </div>
  );
}
