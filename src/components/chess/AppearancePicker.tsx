import { useMemo, useState } from "react";
import { Check, Paintbrush, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { loadPosition, snapshotOf } from "@/lib/chess/engine";
import { PIECE_SETS, type PieceSetInfo } from "@/lib/chess/pieceSets";
import type { BoardStyleId, Role, Side } from "@/lib/chess/types";
import { useSettings } from "@/lib/store/settings";
import {
  CLASSIC_BOARD_STYLES,
  THEMED_BOARD_STYLES,
  themeById,
  type BoardStyleInfo,
} from "@/lib/theme/themes";
import { cn } from "@/lib/utils";
import { boardHasCaptureFx } from "./captureFx";
import { ChessBoard } from "./ChessBoard";
import { PieceSvg } from "./PieceSvg";
import { useActiveBoardStyle, useActivePieceSet } from "./appearance";

/** An Italian Game middlegame: every piece type, both colours, a last move. */
const PREVIEW_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5";

/** Full-size, non-interactive board showing the current pieces and board. */
export function AppearancePreview({ className }: { className?: string }) {
  const snap = useMemo(() => snapshotOf(loadPosition("standard", PREVIEW_FEN), "standard"), []);
  const showCoords = useSettings((s) => s.showCoords);
  return (
    <div className={cn("mx-auto w-full max-w-[22rem]", className)}>
      <ChessBoard
        snap={snap}
        orientation="white"
        interactive={false}
        showCoords={showCoords}
        markLastMove
        highlightLegal={false}
        lastMoves={[{ from: "f8", to: "c5", color: "black" }]}
        selected={null}
        onSelect={() => {}}
        onMove={() => {}}
      />
    </div>
  );
}

/** A strip of squares in a given board style, used inside picker cards. */
function MiniBoard({
  board,
  pieces,
  set,
  cols = 4,
}: {
  board: BoardStyleId;
  pieces: ({ role: Role; color: Side } | null)[];
  set?: PieceSetInfo["id"];
  cols?: number;
}) {
  return (
    <div
      data-board={board}
      className="cm-board-frame pointer-events-none overflow-hidden rounded-[var(--radius-sm)] p-0.5"
      aria-hidden
    >
      <div
        className="grid overflow-hidden rounded-[3px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {pieces.map((p, i) => {
          const row = Math.floor(i / cols);
          const dark = (i + row) % 2 === 1;
          return (
            <div key={i} className={cn("relative aspect-square", dark ? "cm-sq-dark" : "cm-sq-light")}>
              {p && (
                <span className="absolute inset-[6%]">
                  <PieceSvg role={p.role} color={p.color} set={set} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PIECE_SAMPLE: { role: Role; color: Side }[] = [
  { role: "king", color: "white" },
  { role: "queen", color: "black" },
  { role: "knight", color: "white" },
  { role: "bishop", color: "black" },
  { role: "rook", color: "white" },
  { role: "pawn", color: "black" },
];

export function PieceSetPicker() {
  const set = useSettings((s) => s.set);
  const active = useActivePieceSet();
  const board = useActiveBoardStyle();
  return (
    <div role="radiogroup" aria-label="Piece set" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PIECE_SETS.map((p) => {
        const on = active === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-piece-set={p.id}
            onClick={() => set({ pieceSet: p.id })}
            className={cn(
              "rounded-[var(--radius-md)] border p-2.5 text-left transition-colors",
              on ? "border-accent bg-elevated ring-1 ring-accent" : "border-border bg-surface hover:bg-elevated",
            )}
          >
            <MiniBoard board={board} pieces={PIECE_SAMPLE} set={p.id} cols={6} />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{p.name}</span>
              {on && <Check className="size-4 shrink-0 text-accent" aria-hidden />}
            </div>
            <p className="mt-0.5 text-xs text-subtle">{p.line}</p>
            <p className="mt-1 text-[11px] text-subtle/80">
              {p.author} · {p.license}
            </p>
          </button>
        );
      })}
    </div>
  );
}

const BOARD_SAMPLE: ({ role: Role; color: Side } | null)[] = [
  null,
  { role: "knight", color: "black" },
  null,
  { role: "pawn", color: "black" },
  { role: "pawn", color: "white" },
  null,
  { role: "bishop", color: "white" },
  null,
];

function BoardGroup({ title, note, boards }: { title: string; note: string; boards: BoardStyleInfo[] }) {
  const set = useSettings((s) => s.set);
  const active = useActiveBoardStyle();
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        <p className="text-xs text-subtle">{note}</p>
      </div>
      <div role="radiogroup" aria-label={`${title} boards`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {boards.map((b) => {
          const on = active === b.id;
          return (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={on}
              data-board-style={b.id}
              title={b.line}
              onClick={() => set({ boardStyle: b.id, lockThemeAssets: false })}
              className={cn(
                "rounded-[var(--radius-md)] border p-2 text-left transition-colors",
                on ? "border-accent bg-elevated ring-1 ring-accent" : "border-border bg-surface hover:bg-elevated",
              )}
            >
              <MiniBoard board={b.id} pieces={BOARD_SAMPLE} />
              <div className="mt-1.5 flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
                {boardHasCaptureFx(b.id) && (
                  <Sparkles className="size-3.5 shrink-0 text-subtle" aria-label="Capture effects" />
                )}
                {on && <Check className="size-4 shrink-0 text-accent" aria-hidden />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BoardSetPicker() {
  const lock = useSettings((s) => s.lockThemeAssets);
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  return (
    <div className="space-y-5">
      <BoardGroup
        title="Classic"
        note="Flat, high-contrast colours. Best for focused play."
        boards={CLASSIC_BOARD_STYLES}
      />
      <BoardGroup
        title="Themed"
        note="Textured boards from the worlds. Ones marked with a sparkle have capture effects."
        boards={THEMED_BOARD_STYLES}
      />
      <label className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5">
        <span className="text-sm">
          Match the board to the world theme
          <span className="block text-xs text-subtle">
            Uses the {themeById(theme).name} board while this is on.
          </span>
        </span>
        <Switch
          checked={lock}
          onCheckedChange={(v) =>
            set(v ? { lockThemeAssets: true, boardStyle: themeById(theme).defaultBoard } : { lockThemeAssets: false })
          }
        />
      </label>
    </div>
  );
}

/** Button + dialog to change pieces and board without leaving the game. */
export function AppearanceButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className={className}>
          <Paintbrush className="size-4" /> Pieces &amp; board
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Pieces & board"
        className="max-h-[min(90vh,52rem)] w-[min(100%-1.5rem,44rem)] overflow-y-auto p-4 sm:p-6"
      >
        <div className="mt-4 space-y-6">
          <AppearancePreview className="max-w-[16rem]" />
          <section className="space-y-2">
            <h3 className="font-display text-lg">Pieces</h3>
            <PieceSetPicker />
          </section>
          <section className="space-y-2">
            <h3 className="font-display text-lg">Board</h3>
            <BoardSetPicker />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
