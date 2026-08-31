import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Position } from "chessops/chess";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChessBoard } from "@/components/chess/ChessBoard";
import { CoachBubble } from "@/components/chess/CoachBubble";
import {
  isPromotionMove,
  loadPosition,
  playFromTo,
  snapshotOf,
} from "@/lib/chess/engine";
import { DAILY_PUZZLE, PUZZLES, puzzleById } from "@/lib/learn/puzzles";
import { isPuzzleDone, markPuzzleDone } from "@/lib/learn/progress";
import { useSettings } from "@/lib/store/settings";
import { playSfx } from "@/lib/audio/sfx";
import type { GameSnapshot, SquareName } from "@/lib/chess/types";

export const Route = createFileRoute("/puzzles/$id")({ component: PuzzlePage });

function PuzzlePage() {
  const { id } = Route.useParams();
  const puzzle = id === "daily" ? DAILY_PUZZLE : puzzleById(id);
  const settings = useSettings();
  const [selected, setSelected] = useState<SquareName | null>(null);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const posRef = useRef<Position | null>(null);

  useEffect(() => {
    if (!puzzle) return;
    const pos = loadPosition("standard", puzzle.fen);
    posRef.current = pos;
    setSnap(snapshotOf(pos, "standard"));
    setSelected(null);
    setDone(isPuzzleDone(puzzle.id));
    setMsg(puzzle.hint);
  }, [puzzle]);

  if (!puzzle || !snap) {
    return (
      <p className="text-muted">
        Puzzle missing. <Link to="/puzzles">Back to puzzles</Link>.
      </p>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <p className="text-sm text-subtle">
          {puzzle.theme} · ~{puzzle.rating}
        </p>
        <h1 className="font-display text-3xl">{puzzle.title}</h1>
        <p className="text-muted">
          {puzzle.goal === "mate" ? "Find checkmate in one." : "Find the best move."}
        </p>
        <ChessBoard
          snap={snap}
          orientation="white"
          interactive={!done}
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
            if (puzzle.goal === "mate") {
              if (s.over && s.winner === "white") {
                setDone(true);
                setMsg("Correct — mate!");
                markPuzzleDone(puzzle.id);
                playSfx("win", settings.theme);
              } else {
                setMsg("Not mate yet. Keep looking.");
              }
            } else {
              const ok = puzzle.expect.some((e) => e.from === from && e.to === to);
              if (ok) {
                setDone(true);
                setMsg("Correct.");
                markPuzzleDone(puzzle.id);
                playSfx("win", settings.theme);
              } else {
                setMsg("Legal, but not the best move.");
              }
            }
          }}
        />
        <CoachBubble text={msg} />
      </div>
      <aside className="space-y-4">
        {done && (
          <p className="flex items-center gap-2 text-sm text-good">
            <Check className="size-4" /> Solved
          </p>
        )}
        <Button asChild variant="secondary">
          <Link to="/puzzles">All puzzles</Link>
        </Button>
        {!done && (
          <Button variant="ghost" onClick={() => setMsg(puzzle.hint)}>
            Show hint
          </Button>
        )}
      </aside>
    </div>
  );
}
