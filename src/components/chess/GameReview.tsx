import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChessBoard } from "@/components/chess/ChessBoard";
import { MoveList } from "@/components/chess/MoveList";
import { botClient } from "@/lib/chess/bot";
import { loadPosition, snapshotOf } from "@/lib/chess/engine";
import type { AnalyzeItem, PlayedMove, Side, VariantId } from "@/lib/chess/types";
import type { ParsedMove } from "@/lib/fairplay/pgn";
import { useSettings } from "@/lib/store/settings";
import { playSfx } from "@/lib/audio/sfx";
import { cn } from "@/lib/utils";

function toPlayed(m: ParsedMove, analysis?: AnalyzeItem[]): PlayedMove {
  const a = analysis?.find((x) => x.ply === m.ply);
  return {
    uci: m.uci,
    san: m.san,
    fenBefore: m.fenBefore,
    fenAfter: m.fenAfter,
    color: m.color,
    classification: a?.classification,
    cpLoss: a?.cpLoss,
    bestSan: a?.bestSan,
    cp: a?.cp,
  };
}

export function GameReview({
  fenStart,
  moves,
  variant,
  white,
  black,
  result,
  analysis,
  orientation = "white",
}: {
  fenStart: string;
  moves: ParsedMove[];
  variant: VariantId;
  white: string;
  black: string;
  result: string;
  analysis?: AnalyzeItem[] | null;
  orientation?: Side;
}) {
  const settings = useSettings();
  const played = useMemo(
    () => moves.map((m) => toPlayed(m, analysis ?? undefined)),
    [moves, analysis],
  );
  const [ply, setPly] = useState(moves.length);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fen =
    ply === 0
      ? fenStart
      : moves[ply - 1]?.fenAfter ?? fenStart;
  const pos = loadPosition(variant, fen);
  const snap = snapshotOf(pos, variant);

  const go = (n: number) => {
    setPly(Math.max(0, Math.min(moves.length, n)));
    setHint(null);
  };

  const askHint = async () => {
    if (ply >= moves.length) return;
    setBusy(true);
    try {
      const h = await botClient.hint(fen, variant);
      setHint(`${h.san} (${h.eval >= 0 ? "+" : ""}${(h.eval / 100).toFixed(1)})`);
    } catch {
      setHint("Engine busy — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {white} vs {black} · {result}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => go(0)} disabled={ply === 0}>
              Start
            </Button>
            <Button variant="ghost" size="icon" onClick={() => go(ply - 1)} disabled={ply === 0}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[4rem] text-center text-sm tabular-nums text-muted">
              {ply}/{moves.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => go(ply + 1)}
              disabled={ply >= moves.length}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => go(moves.length)} disabled={ply >= moves.length}>
              End
            </Button>
          </div>
        </div>
        <ChessBoard
          snap={snap}
          orientation={orientation}
          interactive={false}
          showCoords={settings.showCoords}
          markLastMove
          highlightLegal={false}
          selected={null}
          onSelect={() => {}}
          onMove={() => {}}
          lastMoves={
            ply > 0
              ? [
                  {
                    from: moves[ply - 1]!.uci.slice(0, 2) as `${string}${string}`,
                    to: moves[ply - 1]!.uci.slice(2, 4) as `${string}${string}`,
                    color: moves[ply - 1]!.color,
                  },
                ]
              : []
          }
        />
        {ply < moves.length && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void askHint()}>
            <Lightbulb className="size-4" /> Best move from here
          </Button>
        )}
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <aside className="space-y-3">
        <MoveList moves={played} ply={ply > 0 ? ply - 1 : undefined} onPly={(i) => go(i + 1)} />
        {analysis && analysis.length > 0 && ply > 0 && played[ply - 1]?.classification && (
          <p
            className={cn(
              "rounded-[var(--radius-sm)] px-3 py-2 text-sm",
              played[ply - 1]?.classification === "blunder" && "bg-danger/15 text-danger",
              played[ply - 1]?.classification === "mistake" && "bg-warn/15 text-warn",
              played[ply - 1]?.classification === "great" && "bg-good/15 text-good",
            )}
          >
            {played[ply - 1]?.classification}
            {played[ply - 1]?.bestSan ? ` · best was ${played[ply - 1]?.bestSan}` : ""}
          </p>
        )}
      </aside>
    </div>
  );
}
