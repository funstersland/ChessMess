import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GameReview } from "@/components/chess/GameReview";
import { Button } from "@/components/ui/button";
import { parseGamePgn } from "@/lib/fairplay/pgn";
import { SAMPLES } from "@/lib/fairplay/samples";

export const Route = createFileRoute("/analysis")({ component: AnalysisPage });

function AnalysisPage() {
  const [pgn, setPgn] = useState("");
  const [loaded, setLoaded] = useState<ReturnType<typeof parseGamePgn> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load(text: string) {
    setErr(null);
    try {
      setLoaded(parseGamePgn(text));
      setPgn(text);
    } catch (e) {
      setLoaded(null);
      setErr(e instanceof Error ? e.message : "Could not parse PGN.");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Analysis board</h1>
        <p className="mt-2 max-w-xl text-muted">
          Paste any PGN to step through the game, see best moves from each position, and review
          stored analysis tags when available.
        </p>
      </div>

      {!loaded ? (
        <div className="space-y-4">
          <textarea
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder="Paste PGN here…"
            className="min-h-40 w-full rounded-[var(--radius-md)] border border-border bg-elevated p-3 font-mono text-xs text-fg"
          />
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => load(pgn)}>Load game</Button>
            <Button
              variant="secondary"
              onClick={() => load(SAMPLES[0]?.pgn ?? "")}
            >
              Try sample
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setLoaded(null)}>
            Load another PGN
          </Button>
          <GameReview
            fenStart={loaded.fenStart}
            moves={loaded.moves}
            variant={loaded.variant}
            white={loaded.white}
            black={loaded.black}
            result={loaded.result}
          />
        </div>
      )}
    </div>
  );
}
