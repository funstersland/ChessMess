import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Side } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";
import { type CaptureFxData, sqCenterPct } from "./captureFx";

export function ForestCaptureFx({
  fx,
  orientation,
  onDone,
}: {
  fx: CaptureFxData;
  orientation: Side;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"fly" | "burn" | "ash">("fly");
  const from = sqCenterPct(fx.from, orientation);
  const to = sqCenterPct(fx.to, orientation);

  const embers = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        x: (i % 5) * 12 - 24,
        delay: i * 40,
        scale: 0.5 + (i % 3) * 0.25,
      })),
    [fx.from, fx.to],
  );

  useEffect(() => {
    setPhase("fly");
    const t1 = window.setTimeout(() => setPhase("burn"), 320);
    const t2 = window.setTimeout(() => setPhase("ash"), 520);
    const t3 = window.setTimeout(() => onDone(), 1180);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fx.from, fx.to, fx.victim.role, fx.victim.color, onDone]);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <div className="cm-forest-capture-fx pointer-events-none absolute inset-0 z-30" aria-hidden>
      <div
        className={cn("cm-forest-fireball absolute", phase === "fly" && "cm-forest-fireball--fly")}
        style={
          {
            left: `${from.x}%`,
            top: `${from.y}%`,
            width: `${dist}%`,
            transform: `rotate(${angle}deg)`,
            transformOrigin: "0% 50%",
          } as CSSProperties
        }
      >
        <span className="cm-forest-flame-core" />
        <span className="cm-forest-flame-trail cm-forest-flame-trail--a" />
        <span className="cm-forest-flame-trail cm-forest-flame-trail--b" />
        <span className="cm-forest-flame-trail cm-forest-flame-trail--c" />
      </div>

      {phase !== "fly" && (
        <div
          className={cn(
            "cm-forest-victim absolute aspect-square -translate-x-1/2 -translate-y-1/2",
            phase === "burn" && "cm-forest-victim--burn",
            phase === "ash" && "cm-forest-victim--ash",
          )}
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "12.5%" }}
        >
          <PieceSvg role={fx.victim.role} color={fx.victim.color} />
          <span className="cm-forest-char" />
          <span className="cm-forest-flames" />
        </div>
      )}

      {(phase === "burn" || phase === "ash") && (
        <div
          className="cm-forest-embers absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "14%", height: "14%" }}
        >
          {embers.map((e) => (
            <span
              key={e.id}
              className="cm-forest-ember absolute bottom-1/2 left-1/2"
              style={
                {
                  "--ember-x": `${e.x}%`,
                  "--ember-scale": e.scale,
                  animationDelay: `${e.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {phase === "burn" && (
        <span
          className="cm-forest-burst absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%` }}
        />
      )}
    </div>
  );
}
