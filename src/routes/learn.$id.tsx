import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "chessops/chess";
import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChessBoard } from "@/components/chess/ChessBoard";
import { CoachBubble } from "@/components/chess/CoachBubble";
import {
  isPromotionMove,
  lastMoveFromUci,
  loadPosition,
  matchesMove,
  playFromTo,
  snapshotOf,
} from "@/lib/chess/engine";
import { LESSONS, lessonById, type LessonStep } from "@/lib/learn/lessons";
import { markLessonDone } from "@/lib/learn/progress";
import { speak } from "@/lib/coach/coach";
import { useSettings } from "@/lib/store/settings";
import { playSfx } from "@/lib/audio/sfx";
import type { GameSnapshot, LastMove, SquareName } from "@/lib/chess/types";

export const Route = createFileRoute("/learn/$id")({ component: LessonRoute });

/** Remount per lesson so "Next lesson" always starts fresh at step 1. */
function LessonRoute() {
  const { id } = Route.useParams();
  return <LessonPage key={id} id={id} />;
}

/** How long a wrong move stays on the board before it is taken back. */
const WRONG_MOVE_MS = 900;

function snapOf(step: LessonStep | undefined) {
  return step ? snapshotOf(loadPosition("standard", step.fen), "standard") : null;
}

function LessonPage({ id }: { id: string }) {
  const nav = useNavigate();
  const lesson = lessonById(id);
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const current = lesson?.steps[step];
  const [selected, setSelected] = useState<SquareName | null>(null);
  const [snap, setSnap] = useState<GameSnapshot | null>(() => snapOf(current));
  const [lastMoves, setLastMoves] = useState<LastMove[]>([]);
  const [done, setDone] = useState(current?.goal === "observe");
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState<string | null>(current?.coach ?? null);
  const posRef = useRef<Position | null>(null);
  const undoTimer = useRef<number | null>(null);

  const idx = LESSONS.findIndex((l) => l.id === id);
  const nextLesson = idx >= 0 ? LESSONS[idx + 1] : undefined;

  const clearUndo = useCallback(() => {
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    undoTimer.current = null;
  }, []);

  const resetBoard = useCallback(
    (message?: string) => {
      if (!current) return;
      clearUndo();
      const pos = loadPosition("standard", current.fen);
      posRef.current = pos;
      setSnap(snapshotOf(pos, "standard"));
      setSelected(null);
      setLastMoves([]);
      setLocked(false);
      setDone(current.goal === "observe");
      setMsg(message ?? current.coach);
    },
    [current, clearUndo],
  );

  useEffect(() => {
    if (!current) return;
    resetBoard();
    speak(current.coach, {
      gender: settings.coachVoice,
      volume: settings.coachVol,
      rate: settings.coachRate,
      enabled: settings.coachOn && settings.sound,
    });
    return clearUndo;
  }, [
    current,
    resetBoard,
    clearUndo,
    settings.coachOn,
    settings.coachRate,
    settings.coachVoice,
    settings.coachVol,
    settings.sound,
  ]);

  if (!lesson || !current || !snap) {
    return (
      <p className="text-muted">
        Lesson missing. <Link to="/learn">Back to the course</Link>.
      </p>
    );
  }

  const last = step === lesson.steps.length - 1;
  const playable = Boolean(current.playable);

  const onMove = (from: SquareName, to: SquareName) => {
    const pos = posRef.current;
    if (!pos || done || locked) return;
    const mover = pos.turn;
    const expected = current.expect ? matchesMove(pos, from, to, current.expect) : false;
    const promo = isPromotionMove(pos, from, to);
    const r = playFromTo(pos, from, to, promo ? "queen" : undefined);
    if (!r) {
      playSfx("illegal", settings.theme);
      return;
    }
    const s = snapshotOf(pos, "standard");
    setSnap(s);
    setSelected(null);
    setLastMoves([lastMoveFromUci(r.uci, mover)]);

    const correct =
      current.goal === "any" ||
      (current.goal === "mate" && s.over && s.winner === mover) ||
      (current.goal === "exact" && expected);
    if (correct) {
      playSfx(s.inCheck ? "check" : r.captured ? "capture" : "move", settings.theme);
      setDone(true);
      if (current.goal === "any") {
        setMsg("That's the idea. Continue when you're ready.");
      } else {
        setMsg(current.goal === "mate" ? `${r.san} — mate. That's the finish.` : `${r.san} — correct.`);
        playSfx("win", settings.theme);
      }
      return;
    }
    // Wrong: show it briefly, then take it back so the player stays on
    // their own side of the board and can try again.
    playSfx("illegal", settings.theme);
    setLocked(true);
    setMsg(
      current.goal === "mate" ? `${r.san} is not mate. Try again.` : `${r.san} is legal, but not the idea. Try again.`,
    );
    undoTimer.current = window.setTimeout(() => {
      resetBoard(
        current.goal === "mate"
          ? `${r.san} was not mate. ${current.coach}`
          : `${r.san} was not it. ${current.coach}`,
      );
    }, WRONG_MOVE_MS);
  };

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
          interactive={playable && !done && !locked}
          showCoords={settings.showCoords}
          markLastMove
          highlightLegal={settings.highlightLegal}
          lastMoves={lastMoves}
          selected={selected}
          onSelect={setSelected}
          onMove={onMove}
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
            disabled={playable && !done}
            onClick={() => {
              if (last) {
                markLessonDone(lesson.id);
                if (nextLesson) void nav({ to: "/learn/$id", params: { id: nextLesson.id } });
                else void nav({ to: "/learn" });
              } else setStep((x) => x + 1);
            }}
          >
            {last ? (nextLesson ? "Next lesson" : "Finish") : "Next"}
          </Button>
          {playable && done && (
            <Button variant="ghost" onClick={() => resetBoard()}>
              <RotateCcw className="size-4" /> Again
            </Button>
          )}
        </div>
        {playable && done && (
          <p className="flex items-center gap-2 text-sm text-good">
            <Check className="size-4" /> Step complete
          </p>
        )}
        <Link to="/learn" className="block text-sm text-muted underline-offset-4 hover:underline">
          All lessons
        </Link>
      </aside>
    </div>
  );
}
