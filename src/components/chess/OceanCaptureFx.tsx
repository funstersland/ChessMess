import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Side } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";
import { type CaptureFxData, sqCenterPct } from "./captureFx";

export function OceanCaptureFx({
  fx,
  orientation,
  onDone,
}: {
  fx: CaptureFxData;
  orientation: Side;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"appear" | "beam" | "vapor">("appear");
  const to = sqCenterPct(fx.to, orientation);

  const mist = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        id: i,
        x: (i % 3) * 18 - 18,
        delay: i * 50,
        scale: 0.7 + (i % 3) * 0.2,
      })),
    [fx.from, fx.to],
  );

  useEffect(() => {
    setPhase("appear");
    const t1 = window.setTimeout(() => setPhase("beam"), 400);
    const t2 = window.setTimeout(() => setPhase("vapor"), 580);
    const t3 = window.setTimeout(() => onDone(), 1280);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fx.from, fx.to, fx.victim.role, fx.victim.color, onDone]);

  return (
    <div className="cm-ocean-capture-fx pointer-events-none absolute inset-0 z-30" aria-hidden>
      <div
        className={cn(
          "cm-ocean-sun absolute -translate-x-1/2",
          phase === "appear" && "cm-ocean-sun--rise",
          (phase === "beam" || phase === "vapor") && "cm-ocean-sun--glow",
          phase === "vapor" && "cm-ocean-sun--fade",
        )}
        style={{ left: `${to.x}%`, top: `${Math.max(to.y - 28, 8)}%`, width: "14%" }}
      >
        <span className="cm-ocean-corona" />
        <span className="cm-ocean-disc" />
        <span className="cm-ocean-rays" />
      </div>

      {(phase === "beam" || phase === "vapor") && (
        <div
          className={cn("cm-ocean-beam absolute", phase === "beam" && "cm-ocean-beam--strike")}
          style={
            {
              left: `${to.x}%`,
              top: `${Math.max(to.y - 28, 8)}%`,
              height: `${Math.max(to.y - Math.max(to.y - 28, 8), 12)}%`,
            } as CSSProperties
          }
        >
          <span className="cm-ocean-beam-core" />
          <span className="cm-ocean-beam-glow" />
        </div>
      )}

      {phase !== "appear" && (
        <div
          className={cn(
            "cm-ocean-victim absolute aspect-square -translate-x-1/2 -translate-y-1/2",
            phase === "beam" && "cm-ocean-victim--heat",
            phase === "vapor" && "cm-ocean-victim--vapor",
          )}
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "12.5%" }}
        >
          <PieceSvg role={fx.victim.role} color={fx.victim.color} />
          <span className="cm-ocean-shimmer" />
        </div>
      )}

      {phase === "vapor" && (
        <div
          className="cm-ocean-mist absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "16%", height: "16%" }}
        >
          {mist.map((m) => (
            <span
              key={m.id}
              className="cm-ocean-mist-puff absolute bottom-1/2 left-1/2"
              style={
                {
                  "--mist-x": `${m.x}%`,
                  "--mist-scale": m.scale,
                  animationDelay: `${m.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {phase === "beam" && (
        <span
          className="cm-ocean-glint absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${to.x}%`, top: `${to.y}%` }}
        />
      )}
    </div>
  );
}
