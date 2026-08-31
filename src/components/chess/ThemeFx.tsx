import { useEffect, useRef } from "react";
import type { WorldThemeId } from "@/lib/chess/types";

type Particle = {
  x: number;
  y: number;
  s: number;
  v: number;
  a: number;
  w: number;
  hue: number;
  kind: number;
  rot: number;
  vr: number;
  phase: number;
};

function countFor(theme: WorldThemeId) {
  switch (theme) {
    case "wood":
      return 55;
    case "paper":
      return 38;
    case "ice":
      return 100;
    case "forest":
      return 65;
    case "ocean":
      return 75;
    case "royal":
      return 50;
    default:
      return 24;
  }
}

function drawSnowflake(
  ctx: CanvasRenderingContext2D,
  r: number,
  arms: number,
  detail: number,
) {
  for (let i = 0; i < arms; i++) {
    ctx.rotate((Math.PI * 2) / arms);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    ctx.stroke();
    if (detail >= 1) {
      const b = r * 0.38;
      const mid = -r * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(b * 0.45, mid - b * 0.35);
      ctx.moveTo(0, mid);
      ctx.lineTo(-b * 0.45, mid - b * 0.35);
      ctx.stroke();
    }
    if (detail >= 2) {
      const tip = -r * 0.82;
      const b2 = r * 0.18;
      ctx.beginPath();
      ctx.moveTo(0, tip);
      ctx.lineTo(b2 * 0.4, tip - b2 * 0.35);
      ctx.moveTo(0, tip);
      ctx.lineTo(-b2 * 0.4, tip - b2 * 0.35);
      ctx.stroke();
    }
  }
}

function drawLeaf(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.85, -size * 0.45, size * 0.75, size * 0.55, 0, size);
  ctx.bezierCurveTo(-size * 0.75, size * 0.55, -size * 0.85, -size * 0.45, 0, -size);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.85);
  ctx.lineTo(0, size * 0.85);
  ctx.stroke();
}

function drawBubble(ctx: CanvasRenderingContext2D, r: number) {
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.45, "rgba(180,230,255,0.18)");
  g.addColorStop(1, "rgba(126,184,200,0.08)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,240,255,0.35)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.28, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawSparkle(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawPaperScrap(ctx: CanvasRenderingContext2D, w: number, h: number, age: number) {
  const fill = age > 0.5 ? "rgba(232,216,184,0.72)" : "rgba(220,204,172,0.65)";
  ctx.fillStyle = fill;
  ctx.strokeStyle = `rgba(90,72,56,${0.12 + age * 0.08})`;
  ctx.lineWidth = 0.6;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = `rgba(138,104,72,${0.06 + age * 0.05})`;
  ctx.beginPath();
  ctx.arc(w * 0.15, h * 0.1, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(106,80,64,${0.1 + age * 0.06})`;
  ctx.beginPath();
  ctx.moveTo(-w * 0.2, -h * 0.12);
  ctx.lineTo(w * 0.22, h * 0.08);
  ctx.stroke();
}

function makeParticle(theme: WorldThemeId): Particle {
  const base: Particle = {
    x: Math.random(),
    y: Math.random(),
    s: 0.35 + Math.random() * 2.2,
    v: 0.06 + Math.random() * 0.4,
    a: 0.1 + Math.random() * 0.55,
    w: 0.5 + Math.random() * 1.6,
    hue: Math.random(),
    kind: Math.floor(Math.random() * 3),
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.02,
    phase: Math.random() * Math.PI * 2,
  };
  if (theme === "wood") {
    return {
      ...base,
      y: Math.random(),
      s: 0.25 + Math.random() * 1.2,
      v: 0.04 + Math.random() * 0.12,
      a: 0.15 + Math.random() * 0.35,
      w: 0.4 + Math.random() * 0.8,
      kind: Math.floor(Math.random() * 2),
    };
  }
  if (theme === "paper") {
    return {
      ...base,
      y: Math.random(),
      s: 0.5 + Math.random() * 1.4,
      v: 0.05 + Math.random() * 0.14,
      a: 0.2 + Math.random() * 0.45,
      w: 0.8 + Math.random() * 1.6,
      kind: 0,
      vr: (Math.random() - 0.5) * 0.015,
    };
  }
  return base;
}

function resetWoodDust(p: Particle) {
  p.x = Math.random();
  p.y = 1.02 + Math.random() * 0.04;
  p.s = 0.25 + Math.random() * 1.2;
  p.v = 0.04 + Math.random() * 0.12;
  p.a = 0.15 + Math.random() * 0.35;
  p.hue = Math.random();
}

export function ThemeFx({ theme }: { theme: WorldThemeId }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const n = countFor(theme);
    const parts: Particle[] = Array.from({ length: n }, () => makeParticle(theme));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      if (theme === "wood") {
        const g = ctx.createRadialGradient(w * 0.5, h, 0, w * 0.5, h * 0.6, h * 0.7);
        g.addColorStop(0, "rgba(200,144,80,0.12)");
        g.addColorStop(1, "rgba(58,32,16,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      if (theme === "paper") {
        const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.75);
        g.addColorStop(0, "rgba(224,208,176,0.05)");
        g.addColorStop(0.65, "rgba(176,152,112,0.08)");
        g.addColorStop(1, "rgba(106,88,64,0.18)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 5; i++) {
          const fx = w * (0.12 + i * 0.18);
          const fy = h * (0.15 + (i % 3) * 0.28);
          const rg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 28 + i * 6);
          rg.addColorStop(0, "rgba(138,104,72,0.07)");
          rg.addColorStop(1, "rgba(138,104,72,0)");
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, w, h);
        }
      }

      if (theme === "ice") {
        const g = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        g.addColorStop(0, "rgba(210,245,255,0.18)");
        g.addColorStop(1, "rgba(200,240,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      if (theme === "royal") {
        const g = ctx.createRadialGradient(w * 0.75, h * 0.1, 0, w * 0.75, h * 0.1, w * 0.55);
        g.addColorStop(0, "rgba(212,175,55,0.08)");
        g.addColorStop(1, "rgba(107,36,56,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      if (theme === "ocean") {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "rgba(30,100,140,0.12)");
        g.addColorStop(0.5, "rgba(20,80,120,0.06)");
        g.addColorStop(1, "rgba(10,60,100,0.18)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const caustic = Math.sin(t * 0.0012) * 0.5 + 0.5;
        const cg = ctx.createRadialGradient(
          w * (0.3 + caustic * 0.4),
          h * (0.2 + Math.sin(t * 0.0008) * 0.1),
          0,
          w * 0.5,
          h * 0.4,
          w * 0.6,
        );
        cg.addColorStop(0, "rgba(120,220,255,0.06)");
        cg.addColorStop(1, "rgba(30,120,180,0)");
        ctx.fillStyle = cg;
        ctx.fillRect(0, 0, w, h);
      }

      if (theme === "forest") {
        const g = ctx.createRadialGradient(w * 0.15, 0, 0, w * 0.15, 0, w * 0.7);
        g.addColorStop(0, "rgba(120,180,90,0.1)");
        g.addColorStop(1, "rgba(58,74,48,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      for (const p of parts) {
        p.rot += p.vr;

        if (theme === "wood") {
          p.y -= p.v * 0.0014;
          p.x += Math.sin(t * 0.0007 + p.hue * 9) * 0.00035;
          if (p.y < -0.04) {
            resetWoodDust(p);
            continue;
          }
          const px = p.x * w;
          const py = p.y * h;
          const dust = p.kind === 0 ? "200,168,120" : "139,90,48";
          ctx.fillStyle = `rgba(${dust},${p.a})`;
          ctx.beginPath();
          ctx.arc(px, py, p.s * (p.kind === 0 ? 1.2 : 0.8), 0, Math.PI * 2);
          ctx.fill();
        } else if (theme === "paper") {
          p.y += p.v * 0.0018;
          p.x += Math.sin(t * 0.0005 + p.hue * 6) * 0.0004;
          if (p.y > 1.06) {
            p.y = -0.06;
            p.x = Math.random();
            p.s = 0.5 + Math.random() * 1.4;
          }
          const px = p.x * w;
          const py = p.y * h;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.a;
          drawPaperScrap(ctx, p.w * 5, p.w * 7, p.hue);
          ctx.restore();
        } else if (theme === "ice") {
          p.y += p.v * 0.0022;
          p.x += Math.sin(p.y * 16 + p.hue * 8 + t * 0.0004) * 0.00065;
          if (p.y > 1.08) {
            p.y = -0.05;
            p.x = Math.random();
            p.s = 0.3 + Math.random() * 2.4;
          }
          const px = p.x * w;
          const py = p.y * h;
          const detail = p.s < 0.8 ? 0 : p.s < 1.5 ? 1 : 2;
          const r = p.s * (detail === 0 ? 2.5 : detail === 1 ? 5 : 9);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot + t * 0.0003 * (p.hue - 0.5));
          ctx.globalAlpha = p.a * (detail === 0 ? 0.7 : detail === 1 ? 0.85 : 1);
          ctx.strokeStyle = "rgba(220,245,255,0.9)";
          ctx.fillStyle = "rgba(232,248,255,0.45)";
          ctx.lineWidth = detail === 0 ? 0.6 : detail === 1 ? 0.9 : 1.2;
          ctx.lineCap = "round";
          drawSnowflake(ctx, r, 6, detail);
          ctx.restore();
        } else if (theme === "forest") {
          p.y += p.v * 0.0025;
          p.x += Math.sin(p.y * 10 + p.hue * 5) * 0.0007 + Math.cos(t * 0.001 + p.hue * 4) * 0.0002;
          if (p.y > 1.06) {
            p.y = -0.05;
            p.x = Math.random();
          }
          const px = p.x * w;
          const py = p.y * h;
          const leafColors =
            p.kind === 0
              ? ["#5a8a48", "#6a9e5a", "#4a7a3a"]
              : p.kind === 1
                ? ["#c4a030", "#d4b040", "#e8c860"]
                : ["#8aaa70", "#b8d4a8", "#a0c080"];
          const color = leafColors[Math.floor(p.hue * leafColors.length) % leafColors.length];
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.a;
          ctx.fillStyle = color;
          drawLeaf(ctx, p.s * 7);
          ctx.restore();
        } else if (theme === "ocean") {
          p.y -= p.v * 0.0016;
          p.x += Math.sin(t * 0.0008 + p.hue * 7) * 0.00035;
          if (p.y < -0.06) {
            p.y = 1.04;
            p.x = Math.random();
            p.s = 0.4 + Math.random() * 2;
          }
          const px = p.x * w;
          const py = p.y * h;
          ctx.save();
          ctx.translate(px, py);
          ctx.globalAlpha = p.a * 0.75;
          drawBubble(ctx, p.s * 5);
          ctx.restore();
        } else if (theme === "royal") {
          p.y -= p.v * 0.001;
          p.x += Math.sin(t * 0.0015 + p.hue * 10) * 0.00025;
          if (p.y < -0.03) {
            p.y = 1.02;
            p.x = Math.random();
          }
          const px = p.x * w;
          const py = p.y * h;
          const pulse = 0.6 + Math.sin(t * 0.003 + p.hue * 20) * 0.4;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot + t * 0.0005);
          ctx.globalAlpha = p.a * pulse;
          if (p.kind === 0) {
            ctx.strokeStyle = "rgba(212,175,55,0.85)";
            ctx.fillStyle = "rgba(230,208,200,0.7)";
            ctx.lineWidth = 0.8;
            drawSparkle(ctx, p.s * 4);
          } else {
            const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, p.s * 3);
            gr.addColorStop(0, `rgba(212,175,55,${p.a})`);
            gr.addColorStop(0.5, `rgba(230,208,200,${p.a * 0.4})`);
            gr.addColorStop(1, "rgba(107,36,56,0)");
            ctx.fillStyle = gr;
            ctx.beginPath();
            ctx.arc(0, 0, p.s * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else {
          p.y -= p.v * 0.0012;
          if (p.y < -0.02) p.y = 1.02;
          const color =
            theme === "noir"
              ? "228, 228, 231"
              : theme === "ivory" || theme === "paper"
                ? "107, 36, 56"
                : "230, 208, 200";
          ctx.fillStyle = `rgba(${color},${p.a * 0.55})`;
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, p.s * 1.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [theme]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden
    />
  );
}
