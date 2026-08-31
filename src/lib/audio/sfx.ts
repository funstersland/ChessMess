import type { WorldThemeId } from "@/lib/chess/types";

type Bus = { master: GainNode; music: GainNode; sfx: GainNode; coach: GainNode };

let ctx: AudioContext | null = null;
let bus: Bus | null = null;
let unlocked = false;
let musicNodes: AudioNode[] = [];
let musicTimer = 0;

function curve(v: number) {
  return v * v;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
  }
  if (!bus) {
    const master = ctx.createGain();
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    const coach = ctx.createGain();
    music.connect(master);
    sfx.connect(master);
    coach.connect(master);
    master.connect(ctx.destination);
    master.gain.value = 0.85;
    music.gain.value = 0.18;
    sfx.gain.value = 0.7;
    coach.gain.value = 0.9;
    bus = { master, music, sfx, coach };
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
}

export function setVolumes(opts: {
  master: number;
  music: number;
  sfx: number;
  coach: number;
  muted: boolean;
}) {
  const c = getCtx();
  if (!c || !bus) return;
  const mute = opts.muted ? 0 : 1;
  const now = c.currentTime;
  bus.master.gain.setTargetAtTime(curve(opts.master) * mute, now, 0.03);
  bus.music.gain.setTargetAtTime(curve(opts.music) * 0.28, now, 0.05);
  bus.sfx.gain.setTargetAtTime(curve(opts.sfx), now, 0.03);
  bus.coach.gain.setTargetAtTime(curve(opts.coach), now, 0.03);
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const n = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(c: AudioContext, dest: AudioNode, start: number, dur: number, peak: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  g.connect(dest);
  return g;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  dest: AudioNode,
  slide = 0,
) {
  const c = getCtx();
  if (!c || !unlocked) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  const g = envGain(c, dest, t, dur, peak);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function burstNoise(dur: number, peak: number, dest: AudioNode, hp = 400, lp = 2400) {
  const c = getCtx();
  if (!c || !unlocked) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.05);
  const hi = c.createBiquadFilter();
  hi.type = "highpass";
  hi.frequency.value = hp;
  const lo = c.createBiquadFilter();
  lo.type = "lowpass";
  lo.frequency.value = lp;
  const g = envGain(c, dest, t, dur, peak);
  src.connect(hi);
  hi.connect(lo);
  lo.connect(g);
  src.start(t);
  src.stop(t + dur + 0.04);
}

export type SfxName =
  | "move"
  | "capture"
  | "check"
  | "castle"
  | "promote"
  | "drop"
  | "illegal"
  | "win"
  | "lose"
  | "draw"
  | "click"
  | "start";

export function playSfx(name: SfxName, theme: WorldThemeId) {
  const c = getCtx();
  if (!c || !bus || !unlocked) return;
  const dest = bus.sfx;
  const wood = theme === "wood";
  const ice = theme === "ice";
  const ocean = theme === "ocean";
  const forest = theme === "forest";
  const paper = theme === "paper";

  switch (name) {
    case "click":
      tone(paper ? 720 : ice ? 1400 : wood ? 320 : 880, 0.05, "triangle", 0.08, dest);
      break;
    case "move":
      if (wood) {
        burstNoise(0.06, 0.07, dest, 180, 700);
        tone(120, 0.09, "sine", 0.11, dest, -20);
      } else if (paper) {
        burstNoise(0.04, 0.05, dest, 400, 2200);
        tone(880, 0.06, "triangle", 0.05, dest);
      } else if (ice) {
        tone(1640, 0.12, "sine", 0.08, dest, 400);
        tone(2460, 0.08, "triangle", 0.04, dest);
      } else if (ocean) {
        burstNoise(0.12, 0.06, dest, 80, 600);
        tone(220, 0.1, "sine", 0.08, dest);
      } else if (forest) {
        burstNoise(0.07, 0.08, dest, 150, 900);
        tone(140, 0.09, "sine", 0.1, dest);
      } else {
        burstNoise(0.06, 0.09, dest, 180, 1200);
        tone(160, 0.07, "sine", 0.11, dest);
      }
      break;
    case "capture":
      burstNoise(0.14, 0.18, dest, wood ? 120 : 120, wood ? 800 : 1600);
      tone(wood ? 100 : paper ? 640 : ice ? 980 : 110, 0.16, wood ? "sine" : "sine", 0.16, dest, wood ? 40 : 80);
      break;
    case "check":
      tone(ice ? 1860 : 520, 0.18, "square", 0.07, dest, ice ? 200 : 80);
      tone(ice ? 1240 : 780, 0.22, "triangle", 0.06, dest);
      break;
    case "castle":
      tone(200, 0.08, "sine", 0.1, dest);
      tone(260, 0.1, "sine", 0.08, dest);
      burstNoise(0.1, 0.08, dest, 200, 1400);
      break;
    case "promote":
      tone(520, 0.12, "triangle", 0.08, dest, 200);
      tone(780, 0.16, "sine", 0.07, dest, 240);
      break;
    case "drop":
      tone(340, 0.1, "triangle", 0.1, dest, -80);
      break;
    case "illegal":
      tone(90, 0.16, "sawtooth", 0.08, dest, -20);
      break;
    case "win":
      tone(523, 0.18, "sine", 0.1, dest);
      tone(659, 0.22, "sine", 0.09, dest);
      tone(784, 0.4, "triangle", 0.08, dest);
      break;
    case "lose":
      tone(220, 0.3, "sine", 0.1, dest, -80);
      tone(160, 0.4, "triangle", 0.08, dest, -40);
      break;
    case "draw":
      tone(330, 0.2, "sine", 0.08, dest);
      tone(330, 0.25, "triangle", 0.05, dest);
      break;
    case "start":
      tone(196, 0.2, "sine", 0.08, dest);
      tone(392, 0.28, "triangle", 0.06, dest);
      break;
  }
}

function stopMusic() {
  for (const n of musicNodes) {
    try {
      (n as OscillatorNode).stop?.();
      n.disconnect();
    } catch {
      /* already stopped */
    }
  }
  musicNodes = [];
  if (musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = 0;
  }
}

export function startThemeMusic(theme: WorldThemeId, enabled: boolean) {
  const c = getCtx();
  if (!c || !bus) return;
  stopMusic();
  if (!enabled || !unlocked) return;

  const dest = bus.music;
  const drones: { f: number; type: OscillatorType; g: number }[] =
    theme === "wood"
      ? [
          { f: 73, type: "sine", g: 0.06 },
          { f: 110, type: "triangle", g: 0.04 },
          { f: 146, type: "sine", g: 0.025 },
        ]
      : theme === "paper"
        ? [
            { f: 220, type: "sine", g: 0.035 },
            { f: 330, type: "triangle", g: 0.025 },
          ]
      : theme === "ice"
        ? [
            { f: 196, type: "sine", g: 0.05 },
            { f: 247, type: "triangle", g: 0.04 },
            { f: 392, type: "sine", g: 0.025 },
          ]
        : theme === "ocean"
          ? [
              { f: 65, type: "sine", g: 0.08 },
              { f: 98, type: "triangle", g: 0.04 },
            ]
          : theme === "forest"
            ? [
                { f: 73, type: "sine", g: 0.06 },
                { f: 110, type: "triangle", g: 0.04 },
              ]
            : theme === "noir"
              ? [
                  { f: 49, type: "sine", g: 0.07 },
                  { f: 98, type: "sine", g: 0.03 },
                ]
              : [
                  { f: 87, type: "sine", g: 0.05 },
                  { f: 130, type: "triangle", g: 0.03 },
                ];

  for (const d of drones) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = d.type;
    o.frequency.value = d.f;
    g.gain.value = d.g;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.07 + Math.random() * 0.05;
    lg.gain.value = d.f * 0.004;
    lfo.connect(lg);
    lg.connect(o.frequency);
    o.connect(g);
    g.connect(dest);
    o.start();
    lfo.start();
    musicNodes.push(o, g, lfo, lg);
  }

  if (theme === "wood" || theme === "ice" || theme === "paper") {
    musicTimer = window.setInterval(() => {
      if (!bus || !unlocked) return;
      if (theme === "wood") burstNoise(0.08, 0.025, dest, 200, 900);
      else if (theme === "paper") burstNoise(0.05, 0.02, dest, 500, 2400);
      else tone(1800 + Math.random() * 800, 0.4, "sine", 0.015, dest, 200);
    }, theme === "wood" ? 2800 : theme === "paper" ? 3200 : 2200);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });
  document.addEventListener("visibilitychange", () => {
    const c = getCtx();
    if (c && document.visibilityState === "visible" && c.state === "suspended") {
      void c.resume();
    }
  });
}
