import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "chessops/chess";
import { ArrowRight, Check, Lightbulb, RotateCcw } from "lucide-react";
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
import { dailyPuzzle, nextPuzzle, puzzleById, type Puzzle } from "@/lib/learn/puzzles";
import { isPuzzleDone, markPuzzleDone } from "@/lib/learn/progress";
import { useSettings } from "@/lib/store/settings";
import { playSfx } from "@/lib/audio/sfx";
import type { GameSnapshot, LastMove, SquareName } from "@/lib/chess/types";

export const Route = createFileRoute("/puzzles/$id")({ component: PuzzlePage });

/** How long a wrong move stays on the board before it is taken back. */
const WRONG_MOVE_MS = 900;

function promptFor(puzzle: Puzzle) {
  const side = loadPosition("standard", puzzle.fen).turn === "white" ? "White" : "Black";
  return `${side} to move. ${puzzle.goal === "mate" ? "Find checkmate in one." : "Find the winning move."}`;
}

function PuzzlePage() {
  const { id } = Route.useParams();
  const puzzle = id === "daily" ? dailyPuzzle() : puzzleById(id);
  const settings = useSettings();
  const [selected, setSelected] = useState<SquareName | null>(null);
  const [snap, setSnap] = useState<GameSnapshot | null>(() =>
    puzzle ? snapshotOf(loadPosition("standard", puzzle.fen), "standard") : null,
  );
  const [lastMoves, setLastMoves] = useState<LastMove[]>([]);
  const [solved, setSolved] = useState(false);
  const [solvedBefore, setSolvedBefore] = useState(false);
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState<string | null>(() => (puzzle ? promptFor(puzzle) : null));
  const posRef = useRef<Position | null>(null);
  const undoTimer = useRef<number | null>(null);

  const clearUndo = useCallback(() => {
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    undoTimer.current = null;
  }, []);

  const reset = useCallback(
    (message?: string) => {
      if (!puzzle) return;
      clearUndo();
      const pos = loadPosition("standard", puzzle.fen);
      posRef.current = pos;
      setSnap(snapshotOf(pos, "standard"));
      setSelected(null);
      setLastMoves([]);
      setSolved(false);
      setLocked(false);
      setMsg(message ?? promptFor(puzzle));
    },
    [puzzle, clearUndo],
  );

  useEffect(() => {
    reset();
    setSolvedBefore(puzzle ? isPuzzleDone(puzzle.id) : false);
    return clearUndo;
  }, [puzzle, reset, clearUndo]);

  if (!puzzle || !snap) {
    return (
      <p className="text-muted">
        Puzzle missing. <Link to="/puzzles">Back to puzzles</Link>.
      </p>
    );
  }

  const orientation = loadPosition("standard", puzzle.fen).turn;
  const next = nextPuzzle(puzzle.id);

  const onMove = (from: SquareName, to: SquareName) => {
    const pos = posRef.current;
    if (!pos || solved || locked) return;
    const mover = pos.turn;
    const expected = puzzle.goal === "exact" && matchesMove(pos, from, to, puzzle.expect);
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
      puzzle.goal === "mate" ? s.over && s.winner === mover : expected;
    if (correct) {
      playSfx(s.inCheck ? "check" : "move", settings.theme);
      setSolved(true);
      setSolvedBefore(true);
      setMsg(puzzle.goal === "mate" ? `${r.san} — checkmate. Solved!` : `${r.san} — correct. Solved!`);
      markPuzzleDone(puzzle.id);
      playSfx("win", settings.theme);
      return;
    }
    // Wrong: show the move for a moment, then take it back so the
    // player never ends up moving the other side's pieces.
    playSfx("illegal", settings.theme);
    setLocked(true);
    setMsg(
      puzzle.goal === "mate"
        ? `${r.san} is not mate. Try again.`
        : `${r.san} does not win. Try again.`,
    );
    undoTimer.current = window.setTimeout(() => {
      reset(
        puzzle.goal === "mate"
          ? `${r.san} was not mate. Look for a check that leaves no escape.`
          : `${r.san} does not win. Look again.`,
      );
    }, WRONG_MOVE_MS);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <p className="text-sm text-subtle">
          {id === "daily" ? "Daily puzzle · " : ""}
          {puzzle.theme} · ~{puzzle.rating}
        </p>
        <h1 className="font-display text-3xl">{puzzle.title}</h1>
        <p className="text-muted">
          {puzzle.goal === "mate" ? "Find checkmate in one." : "Find the only winning move."}
        </p>
        <ChessBoard
          snap={snap}
          orientation={orientation}
          interactive={!solved && !locked}
          showCoords={settings.showCoords}
          markLastMove
          highlightLegal={settings.highlightLegal}
          lastMoves={lastMoves}
          selected={selected}
          onSelect={setSelected}
          onMove={onMove}
        />
        <CoachBubble text={msg} />
      </div>
      <aside className="space-y-3">
        {(solved || solvedBefore) && (
          <p className="flex items-center gap-2 text-sm text-good">
            <Check className="size-4" /> {solved ? "Solved" : "Solved before — play it again"}
          </p>
        )}
        {solved ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/puzzles/$id" params={{ id: next.id }}>
                Next puzzle <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => reset()}>
              <RotateCcw className="size-4" /> Try again
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setMsg(puzzle.hint)} disabled={locked}>
            <Lightbulb className="size-4" /> Show hint
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link to="/puzzles">All puzzles</Link>
        </Button>
      </aside>
    </div>
  );
}
