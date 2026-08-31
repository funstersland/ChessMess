import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Side } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";
import { type CaptureFxData, sqCenterPct } from "./captureFx";

function PaperScissors({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-full drop-shadow-sm", className)} aria-hidden>
      <circle cx="8" cy="22" r="3.5" fill="none" stroke="#555" strokeWidth="1.2" />
      <circle cx="24" cy="22" r="3.5" fill="none" stroke="#555" strokeWidth="1.2" />
      <path d="M8 22 L16 8 L24 22" fill="none" stroke="#888" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10 20 L16 10 L22 20" fill="#c8c8c8" stroke="#666" strokeWidth="0.6" />
      <path d="M14 12 L16 8 L18 12 Z" fill="#aaa" stroke="#555" strokeWidth="0.5" />
    </svg>
  );
}

export function PaperCaptureFx({
  fx,
  orientation,
  onDone,
}: {
  fx: CaptureFxData;
  orientation: Side;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"fly" | "snip" | "tear">("fly");
  const from = sqCenterPct(fx.from, orientation);
  const to = sqCenterPct(fx.to, orientation);

  const scraps = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        x: (i % 4) * 10 - 15,
        rot: (i % 5) * 18 - 36,
        delay: i * 45,
        w: 5 + (i % 3) * 2,
        h: 3 + (i % 2),
      })),
    [fx.from, fx.to],
  );

  useEffect(() => {
    setPhase("fly");
    const t1 = window.setTimeout(() => setPhase("snip"), 320);
    const t2 = window.setTimeout(() => setPhase("tear"), 480);
    const t3 = window.setTimeout(() => onDone(), 1220);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fx.from, fx.to, fx.victim.role, fx.victim.color, onDone]);

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return (
    <div className="cm-paper-capture-fx pointer-events-none absolute inset-0 z-30" aria-hidden>
      <div
        className={cn("cm-paper-scissors absolute", phase === "fly" && "cm-paper-scissors--fly")}
        style={
          {
            left: `${from.x}%`,
            top: `${from.y}%`,
            width: "10%",
            "--snip-dx": `${dx}%`,
            "--snip-dy": `${dy}%`,
          } as CSSProperties
        }
      >
        <PaperScissors />
      </div>

      {phase !== "fly" && (
        <div
          className="cm-paper-victim-wrap absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "12.5%", height: "12.5%" }}
        >
          <div
            className={cn(
              "cm-paper-half cm-paper-half--left absolute inset-0 overflow-hidden",
              phase === "snip" && "cm-paper-half--snip",
              phase === "tear" && "cm-paper-half--tear-left",
            )}
          >
            <PieceSvg role={fx.victim.role} color={fx.victim.color} />
            <span className="cm-paper-texture" />
          </div>
          <div
            className={cn(
              "cm-paper-half cm-paper-half--right absolute inset-0 overflow-hidden",
              phase === "snip" && "cm-paper-half--snip",
              phase === "tear" && "cm-paper-half--tear-right",
            )}
          >
            <PieceSvg role={fx.victim.role} color={fx.victim.color} />
            <span className="cm-paper-texture" />
          </div>
          {phase === "snip" && <span className="cm-paper-tear-line absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />}
        </div>
      )}

      {phase === "tear" && (
        <div
          className="cm-paper-scraps absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "14%", height: "14%" }}
        >
          {scraps.map((s) => (
            <span
              key={s.id}
              className="cm-paper-scrap absolute left-1/2 top-1/2"
              style={
                {
                  width: `${s.w}px`,
                  height: `${s.h}px`,
                  "--scrap-x": `${s.x}px`,
                  "--scrap-rot": `${s.rot}deg`,
                  animationDelay: `${s.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {phase === "snip" && (
        <span
          className="cm-paper-snip-flash absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%` }}
        />
      )}
    </div>
  );
}
