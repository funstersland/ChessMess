import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Side } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";
import { type CaptureFxData, sqCenterPct } from "./captureFx";

export function NoirCaptureFx({
  fx,
  orientation,
  onDone,
}: {
  fx: CaptureFxData;
  orientation: Side;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"open" | "suck" | "collapse">("open");
  const from = sqCenterPct(fx.from, orientation);
  const to = sqCenterPct(fx.to, orientation);

  const spirals = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        angle: i * 36 + (i % 2) * 18,
        delay: i * 35,
        size: 3 + (i % 3),
      })),
    [fx.from, fx.to],
  );

  useEffect(() => {
    setPhase("open");
    const t1 = window.setTimeout(() => setPhase("suck"), 380);
    const t2 = window.setTimeout(() => setPhase("collapse"), 980);
    const t3 = window.setTimeout(() => onDone(), 1380);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fx.from, fx.to, fx.victim.role, fx.victim.color, onDone]);

  const victimStyle = {
    "--from-x": `${from.x}%`,
    "--from-y": `${from.y}%`,
    "--to-x": `${to.x}%`,
    "--to-y": `${to.y}%`,
  } as CSSProperties;

  return (
    <div className="cm-noir-capture-fx pointer-events-none absolute inset-0 z-30" aria-hidden>
      <div
        className={cn(
          "cm-noir-hole absolute -translate-x-1/2 -translate-y-1/2",
          phase === "open" && "cm-noir-hole--open",
          phase === "suck" && "cm-noir-hole--active",
          phase === "collapse" && "cm-noir-hole--collapse",
        )}
        style={{ left: `${from.x}%`, top: `${from.y}%`, width: "16%" }}
      >
        <span className="cm-noir-rift" />
        <span className="cm-noir-accretion" />
        <span className="cm-noir-horizon" />
        <span className="cm-noir-lens" />
      </div>

      {(phase === "suck" || phase === "collapse") && (
        <div
          className={cn(
            "cm-noir-victim absolute aspect-square",
            phase === "suck" && "cm-noir-victim--suck",
            phase === "collapse" && "cm-noir-victim--gone",
          )}
          style={{ ...victimStyle, width: "12.5%" }}
        >
          <PieceSvg role={fx.victim.role} color={fx.victim.color} />
          <span className="cm-noir-stretch" />
        </div>
      )}

      {phase === "suck" && (
        <div
          className="cm-noir-spirals absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${from.x}%`, top: `${from.y}%`, width: "20%", height: "20%" }}
        >
          {spirals.map((s) => (
            <span
              key={s.id}
              className="cm-noir-spiral-bit absolute left-1/2 top-1/2"
              style={
                {
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  "--spiral-angle": `${s.angle}deg`,
                  animationDelay: `${s.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {phase === "open" && (
        <span
          className="cm-noir-burst absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${from.x}%`, top: `${from.y}%` }}
        />
      )}
    </div>
  );
}
