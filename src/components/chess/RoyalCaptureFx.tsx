import { useEffect, useState } from "react";
import type { Side } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { PieceSvg } from "./PieceSvg";
import type { CaptureFxData } from "./captureFx";
import { sqCenterPct } from "./captureFx";

export function RoyalCaptureFx({
  fx,
  orientation,
  onDone,
}: {
  fx: CaptureFxData;
  orientation: Side;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"fly" | "hit" | "dead">("fly");
  const from = sqCenterPct(fx.from, orientation);
  const to = sqCenterPct(fx.to, orientation);

  useEffect(() => {
    setPhase("fly");
    const t1 = window.setTimeout(() => setPhase("hit"), 360);
    const t2 = window.setTimeout(() => setPhase("dead"), 480);
    const t3 = window.setTimeout(() => onDone(), 1180);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fx.from, fx.to, fx.victim.role, fx.victim.color, onDone]);

  return (
    <div className="cm-royal-capture-fx pointer-events-none absolute inset-0 z-30" aria-hidden>
      <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient
            id="cm-royal-arrow-grad"
            gradientUnits="userSpaceOnUse"
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
          >
            <stop offset="0%" stopColor="rgba(160,0,24,0.15)" />
            <stop offset="35%" stopColor="#a80018" />
            <stop offset="88%" stopColor="#c5001a" />
            <stop offset="100%" stopColor="#fff5f5" />
          </linearGradient>
          <marker id="cm-royal-arrowhead" markerWidth="4" markerHeight="4" refX="3.2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#8b0014" />
          </marker>
        </defs>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          className={cn("cm-royal-arrow-line", phase !== "fly" && "cm-royal-arrow-line--struck")}
          stroke="url(#cm-royal-arrow-grad)"
          strokeWidth="0.65"
          strokeLinecap="round"
          markerEnd="url(#cm-royal-arrowhead)"
        />
      </svg>

      {phase !== "fly" && (
        <div
          className={cn(
            "cm-royal-victim absolute aspect-square -translate-x-1/2 -translate-y-1/2",
            phase === "hit" && "cm-royal-victim--hit",
            phase === "dead" && "cm-royal-victim--dead",
          )}
          style={{ left: `${to.x}%`, top: `${to.y}%`, width: "12.5%" }}
        >
          <PieceSvg role={fx.victim.role} color={fx.victim.color} />
          <span className="cm-royal-blood-splash" />
          <span className="cm-royal-blood-drip" />
        </div>
      )}

      {phase === "hit" && (
        <span className="cm-royal-impact-flash absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${to.x}%`, top: `${to.y}%` }} />
      )}
    </div>
  );
}
