import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shield, Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ReportCard } from "@/components/fairplay/ReportCard";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { scanGame } from "@/lib/fairplay/scan";
import { SAMPLES } from "@/lib/fairplay/samples";
import { pct, verdictLabel } from "@/lib/fairplay/score";
import type { ScanProgress, ScanReport } from "@/lib/fairplay/types";
import type { Side } from "@/lib/chess/types";
import {
  getFairPlayMe,
  listMyScans,
  submitFairPlayScan,
  type FairPlayMe,
  type FairPlayScanRow,
} from "@/lib/server/fairplay";
import { listMyGames } from "@/lib/server/profile";
import { cn } from "@/lib/utils";

type Search = { game?: string; sample?: string };

export const Route = createFileRoute("/fair-play")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    game: typeof s.game === "string" ? s.game : undefined,
    sample: typeof s.sample === "string" ? s.sample : undefined,
  }),
  component: FairPlayPage,
});

function FairPlayPage() {
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<FairPlayMe | null>(null);
  const [scans, setScans] = useState<FairPlayScanRow[]>([]);
  const [pgn, setPgn] = useState("");
  const [color, setColor] = useState<Side>("white");
  const [rating, setRating] = useState(1500);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [filed, setFiled] = useState<string | null>(null);
  const [caseFiled, setCaseFiled] = useState(false);
  const [asReport, setAsReport] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getFairPlayMe()
      .then(setMe)
      .catch(() => setMe(null));
    void listMyScans()
      .then(setScans)
      .catch(() => setScans([]));
  }, [user]);

  useEffect(() => {
    const sample = SAMPLES.find((s) => s.id === search.sample);
    if (sample) {
      setPgn(sample.pgn);
      setColor(sample.color);
      setRating(sample.rating);
    }
  }, [search.sample]);

  useEffect(() => {
    if (!search.game || !user) return;
    void listMyGames()
      .then((rows) => {
        const g = rows.find((r) => r.id === search.game);
        if (!g) return;
        setPgn(g.pgn);
        setColor(g.color as Side);
        setRating(g.rating_after || 1500);
      })
      .catch(() => {});
  }, [search.game, user]);

  const pctDone = useMemo(() => {
    if (!progress || progress.phase !== "scan" || !progress.total) return 0;
    return Math.round(((progress.ply ?? 0) / progress.total) * 100);
  }, [progress]);

  async function run(source: "pgn" | "sample" | "history", sampleId?: string) {
    const text = pgn.trim();
    if (!text) {
      toast.error("Paste a PGN first.");
      return;
    }
    setBusy(true);
    setFiled(null);
    setCaseFiled(false);
    setReport(null);
    setProgress({ phase: "wake", message: "Waking engines…" });
    try {
      const scanned = await scanGame(
        { pgn: text, color, rating, opponent: "Opponent" },
        setProgress,
      );
      setReport(scanned);
      if (user && source !== "sample") {
        const res = await submitFairPlayScan({
          data: {
            id: crypto.randomUUID(),
            gameId: source === "history" ? search.game : undefined,
            opponent: scanned.opponent,
            color,
            variant: scanned.variant,
            source: asReport ? "report" : source,
            pgn: text,
            fenStart: scanned.fenStart,
            rating,
            metrics: scanned.metrics,
            report: scanned,
            kind: asReport ? "report" : "auto",
            subjectName: asReport ? scanned.opponent || "Accused" : undefined,
          },
        });
        if (res.caseId) {
          setFiled("Flagged and sent to the steward. Play continues until they approve a suspension.");
          setCaseFiled(true);
          toast.error("Fair Play flagged this game");
          void getFairPlayMe().then(setMe);
          void listMyScans().then(setScans);
        } else {
          setFiled(`Recorded as ${verdictLabel(res.verdict)}.`);
          void listMyScans().then(setScans);
        }
      } else if (source === "sample") {
        setFiled("Sample scan — not filed against your account.");
      } else {
        setFiled("Sign in to file a flag with the steward.");
      }
      void sampleId;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">Fair Play</p>
          <h1 className="font-display text-4xl leading-[1.1] text-fg">Fair Play with Stockfish.</h1>
          <p className="max-w-xl text-lg text-muted">
            Stockfish reads every move after the opening. High engine agreement at a human rating is
            flagged. Only a steward can suspend.
          </p>
          {me && (
            <div className="flex flex-wrap gap-2">
              <Badge tone={me.status === "suspended" ? "danger" : me.status === "flagged" ? "warn" : "good"}>
                {me.status === "ok" ? "Clear" : me.status}
              </Badge>
              {me.score != null && (
                <Badge tone="muted">Integrity {me.score}</Badge>
              )}
              {me.isAdmin && (
                <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted underline-offset-4 hover:underline">
                  <Scale className="size-3.5" /> Steward desk
                </Link>
              )}
            </div>
          )}
          {me?.status === "suspended" && (
            <p className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              Account suspended{me.suspendReason ? ` — ${me.suspendReason}` : "."} Rated play is closed.
            </p>
          )}
          {me?.status === "flagged" && (
            <p className="rounded-[var(--radius-md)] border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
              A game is waiting on the steward. You can still play until they decide.
            </p>
          )}
        </div>
        <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-[var(--radius-md)] bg-elevated">
              <Shield className="size-5" />
            </div>
            <div>
              <div className="font-medium">How a flag is made</div>
              <p className="text-sm text-muted">
                Stockfish top-1 match rate vs your rating band sets the risk score.
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>Opening moves and forced replies are ignored.</li>
            <li>A flag files a case. It does not suspend you.</li>
            <li>A steward reviews and approves any suspension — or restores you.</li>
            <li>After a friend game you can report the opponent. Their moves are scanned.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">Scan a game</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setPgn(s.pgn);
                setColor(s.color);
                setRating(s.rating);
              }}
              className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-left hover:bg-elevated"
            >
              <div className="text-sm font-medium">{s.name}</div>
              <p className="mt-1 text-xs text-subtle">{s.blurb}</p>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pgn">PGN</Label>
          <textarea
            id="pgn"
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder="Paste a PGN…"
            className="min-h-40 w-full rounded-[var(--radius-md)] border border-border bg-elevated p-3 font-mono text-xs text-fg"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Side to judge</Label>
            <div className="flex gap-2">
              {(["white", "black"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-11 rounded-[var(--radius-sm)] border px-4 text-sm capitalize",
                    color === c ? "border-accent bg-elevated" : "border-border bg-surface",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rating">Claimed rating</Label>
            <input
              id="rating"
              type="number"
              min={400}
              max={3200}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value) || 1500)}
              className="h-11 w-28 rounded-[var(--radius-sm)] border border-border bg-elevated px-3 text-sm tabular-nums"
            />
          </div>
          <Button
            disabled={busy}
            onClick={() => {
              const sample = SAMPLES.find((s) => s.pgn.trim() === pgn.trim());
              void run(sample ? "sample" : search.game ? "history" : "pgn", sample?.id);
            }}
          >
            {busy ? "Scanning…" : "Run engines"}
          </Button>
          <label className="flex h-11 items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={asReport}
              onChange={(e) => setAsReport(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
            File as a report against the judged side
          </label>
        </div>
        {progress && (
          <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="text-sm">{progress.message}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${progress.phase === "scan" ? pctDone : 12}%` }}
              />
            </div>
          </div>
        )}
        {filed && <p className="text-sm text-muted">{filed}</p>}
        {report &&
          user &&
          !caseFiled &&
          (report.verdict === "flag" || report.verdict === "severe") && (
            <Button
              variant="secondary"
              onClick={() => {
                void submitFairPlayScan({
                  data: {
                    id: crypto.randomUUID(),
                    opponent: report.opponent,
                    color,
                    variant: report.variant,
                    source: asReport ? "report" : "pgn",
                    pgn: pgn.trim(),
                    fenStart: report.fenStart,
                    rating,
                    metrics: report.metrics,
                    report,
                    kind: asReport ? "report" : "auto",
                    subjectName: asReport ? report.opponent || "Accused" : undefined,
                  },
                })
                  .then((res) => {
                    if (res.caseId) {
                      setFiled("Flagged and sent to the steward.");
                      setCaseFiled(true);
                      toast.error("Case filed");
                      void getFairPlayMe().then(setMe);
                      void listMyScans().then(setScans);
                    } else {
                      setFiled(`Recorded as ${verdictLabel(res.verdict)}.`);
                    }
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Could not file"));
              }}
            >
              File this flag with the steward
            </Button>
          )}
        {report && <ReportCard report={report} />}
      </section>

      {!isPending && user && scans.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Your scans</h2>
          <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
            {scans.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge
                  tone={
                    s.verdict === "clean"
                      ? "good"
                      : s.verdict === "watch"
                        ? "warn"
                        : s.verdict === "flag" || s.verdict === "severe"
                          ? "danger"
                          : "muted"
                  }
                >
                  {verdictLabel(s.verdict)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    vs {s.opponent || "unknown"} · risk {s.risk}
                  </div>
                  <div className="text-xs text-subtle">
                    SF {s.stockfishTop1 != null ? pct(s.stockfishTop1) : "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
