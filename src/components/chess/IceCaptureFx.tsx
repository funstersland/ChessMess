import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Side } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";
import { type CaptureFxData, sqCenterPct } from "./captureFx";

export function IceCaptureFx({
  fx,
  orientation,
  onDone,
}: {
  fx: CaptureFxData;
  orientation: Side;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"blow" | "melt" | "vanish">("blow");
  const from = sqCenterPct(fx.from, orientation);
  const to = sqCenterPct(fx.to, orientation);

  const steam = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        x: (i % 4) * 14 - 21,
        delay: i * 55,
        scale: 0.6 + (i % 3) * 0.2,
      })),
    [fx.from, fx.to],
  );

  useEffect(() => {
    setPhase("blow");
    const t1 = window.setTimeout(() => setPhase("melt"), 380);
    const t2 = window.setTimeout(() => setPhase("vanish"), 720);
    const t3 = window.setTimeout(() => onDone(), 1280);
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
    <div className="cm-ice-capture-fx pointer-events-none absolute inset-0 z-30" aria-hidden>
      <div
        className={cn("cm-ice-hot-air absolute", phase === "blow" && "cm-ice-hot-air--blow")}
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
        <span className="cm-ice-hot-core" />
        <span className="cm-ice-hot-wisp cm-ice-hot-wisp--a" />
        <span className="cm-ice-hot-wisp cm-ice-hot-wisp--b" />
        <span className="cm-ice-hot-wisp cm-ice-hot-wisp--c" />
      </div>

      {phase !== "blow" && (
        <div
          className={cn(
            "cm-ice-victim absolute aspect-square -translate-x-1/2 -translate-y-1/2",
            phase === "melt" && "cm-ice-victim--melt",
            phase === "vanish" && "cm-ice-victim--vanish",
          )}
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "12.5%" }}
        >
          <PieceSvg role={fx.victim.role} color={fx.victim.color} />
          <span className="cm-ice-frost" />
          <span className="cm-ice-drip cm-ice-drip--a" />
          <span className="cm-ice-drip cm-ice-drip--b" />
          <span className="cm-ice-drip cm-ice-drip--c" />
        </div>
      )}

      {(phase === "melt" || phase === "vanish") && (
        <div
          className="cm-ice-steam absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "14%", height: "14%" }}
        >
          {steam.map((s) => (
            <span
              key={s.id}
              className="cm-ice-steam-puff absolute bottom-1/2 left-1/2"
              style={
                {
                  "--steam-x": `${s.x}%`,
                  "--steam-scale": s.scale,
                  animationDelay: `${s.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {phase === "melt" && (
        <span
          className="cm-ice-heat-flash absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%` }}
        />
      )}
    </div>
  );
}
