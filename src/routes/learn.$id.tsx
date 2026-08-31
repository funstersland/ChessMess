import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Position } from "chessops/chess";
import { Button } from "@/components/ui/button";
import { ChessBoard } from "@/components/chess/ChessBoard";
import { CoachBubble } from "@/components/chess/CoachBubble";
import {
  isPromotionMove,
  loadPosition,
  playFromTo,
  snapshotOf,
} from "@/lib/chess/engine";
import { LESSONS, lessonById } from "@/lib/learn/lessons";
import { speak } from "@/lib/coach/coach";
import { useSettings } from "@/lib/store/settings";
import { playSfx } from "@/lib/audio/sfx";
import type { GameSnapshot, SquareName } from "@/lib/chess/types";

export const Route = createFileRoute("/learn/$id")({ component: LessonPage });

function LessonPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const lesson = lessonById(id);
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<SquareName | null>(null);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const posRef = useRef<Position | null>(null);

  const current = lesson?.steps[step];
  const idx = LESSONS.findIndex((l) => l.id === id);
  const nextLesson = idx >= 0 ? LESSONS[idx + 1] : undefined;

  useEffect(() => {
    if (!current) return;
    const pos = loadPosition("standard", current.fen);
    posRef.current = pos;
    setSnap(snapshotOf(pos, "standard"));
    setSelected(null);
    setDone(current.goal === "observe");
    setMsg(current.coach);
    speak(current.coach, {
      gender: settings.coachVoice,
      volume: settings.coachVol,
      rate: settings.coachRate,
      enabled: settings.coachOn && settings.sound,
    });
  }, [current, settings.coachOn, settings.coachRate, settings.coachVoice, settings.coachVol, settings.sound]);

  if (!lesson || !current || !snap) {
    return (
      <p className="text-muted">
        Lesson missing. <Link to="/learn">Back to the course</Link>.
      </p>
    );
  }

  const last = step === lesson.steps.length - 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <p className="text-sm text-subtle">
          {lesson.chapter} · {step + 1}/{lesson.steps.length}
        </p>
        <h1 className="font-display text-3xl">{current.title}</h1>
        <p className="text-muted">{current.body}</p>
        <ChessBoard
          snap={snap}
          orientation="white"
          interactive={Boolean(current.playable) && !done}
          showCoords={settings.showCoords}
          markLastMove
          highlightLegal={settings.highlightLegal}
          lastMoves={[]}
          selected={selected}
          onSelect={setSelected}
          onMove={(from, to) => {
            const pos = posRef.current;
            if (!pos) return;
            const promo = isPromotionMove(pos, from, to);
            const r = playFromTo(pos, from, to, promo ? "queen" : undefined);
            if (!r) {
              playSfx("illegal", settings.theme);
              return;
            }
            playSfx("move", settings.theme);
            const s = snapshotOf(pos, "standard");
            setSnap(s);
            setSelected(null);
            const expect = current.expect;
            if (current.goal === "any") {
              setDone(true);
              setMsg("That's the idea. Continue when you're ready.");
            } else if (current.goal === "mate") {
              if (s.over && s.winner === "white") {
                setDone(true);
                setMsg("Mate. That's the finish.");
                playSfx("win", settings.theme);
              } else {
                setMsg("Not mate yet. Try the back rank.");
              }
            } else if (current.goal === "exact" && expect) {
              const ok = expect.some((e) => e.from === from && e.to === to);
              if (ok) {
                setDone(true);
                setMsg("Correct.");
                playSfx("win", settings.theme);
              } else {
                setMsg("Legal, but not the idea. Look again.");
              }
            }
          }}
          reviewSquares={current.highlight}
        />
        <CoachBubble text={msg} />
      </div>
      <aside className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={step === 0}
            onClick={() => setStep((x) => Math.max(0, x - 1))}
          >
            Previous
          </Button>
          <Button
            disabled={Boolean(current.playable) && !done}
            onClick={() => {
              if (last) {
                if (nextLesson) void nav({ to: "/learn/$id", params: { id: nextLesson.id } });
                else void nav({ to: "/learn" });
              } else setStep((x) => x + 1);
            }}
          >
            {last ? (nextLesson ? "Next lesson" : "Finish") : "Next"}
          </Button>
        </div>
        <Link to="/learn" className="block text-sm text-muted underline-offset-4 hover:underline">
          All lessons
        </Link>
      </aside>
    </div>
  );
}
