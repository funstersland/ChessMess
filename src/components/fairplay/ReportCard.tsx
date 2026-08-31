import { Badge } from "@/components/ui/badge";
import { ENGINE_META, type ScanReport, type Verdict } from "@/lib/fairplay/types";
import { pct, verdictLabel } from "@/lib/fairplay/score";
import { cn } from "@/lib/utils";

function toneFor(v: Verdict): "good" | "warn" | "danger" | "muted" {
  if (v === "clean") return "good";
  if (v === "watch") return "warn";
  if (v === "flag" || v === "severe") return "danger";
  return "muted";
}

export function ReportCard({ report }: { report: ScanReport }) {
  const m = report.metrics;
  const sf = m.stockfish;
  const width = `${report.risk}%`;
  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted">Risk</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-display text-4xl tabular-nums leading-none">{report.risk}</span>
              <Badge tone={toneFor(report.verdict)}>{verdictLabel(report.verdict)}</Badge>
            </div>
          </div>
          <div className="text-right text-sm text-muted">
            <div>
              Accuracy {Math.round(m.accuracy)} · {m.considered} moves read
            </div>
            <div className="text-xs text-subtle">
              Expected Stockfish top-1 at {report.rating} elo: {pct(m.expectedTop1)}
              {(m.streak ?? 0) > 0 ? ` · streak ${m.streak}` : ""}
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-elevated">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              report.verdict === "clean" && "bg-good",
              report.verdict === "watch" && "bg-warn",
              (report.verdict === "flag" || report.verdict === "severe") && "bg-danger",
              report.verdict === "insufficient" && "bg-muted",
            )}
            style={{ width }}
          />
        </div>
        <p className="mt-3 text-sm text-muted">
          Stockfish reads every move after the opening. A flag is a request — only a steward can
          suspend.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-accent bg-elevated p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">{ENGINE_META.stockfish.name}</div>
          <Badge tone="accent">Engine</Badge>
        </div>
        <p className="mt-1 text-xs text-subtle">{ENGINE_META.stockfish.blurb}</p>
        {sf.ready ? (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="font-display text-lg tabular-nums">{pct(sf.top1)}</div>
              <div className="text-[11px] text-subtle">Top-1</div>
            </div>
            <div>
              <div className="font-display text-lg tabular-nums">{pct(sf.top3)}</div>
              <div className="text-[11px] text-subtle">Top-3</div>
            </div>
            <div>
              <div className="font-display text-lg tabular-nums">{Math.round(sf.acpl)}</div>
              <div className="text-[11px] text-subtle">ACPL</div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">{sf.error ?? "Offline"}</p>
        )}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">Move sheet</div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Move</th>
                <th className="px-3 py-2 font-medium">Stockfish</th>
              </tr>
            </thead>
            <tbody>
              {report.moves.map((mv) => {
                const hit = mv.engines.find((e) => e.id === "stockfish");
                return (
                  <tr
                    key={mv.ply}
                    className={cn(
                      "border-t border-border",
                      !mv.considered && "opacity-50",
                    )}
                  >
                    <td className="px-3 py-2 tabular-nums text-subtle">{mv.ply + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {mv.san}
                      {mv.skipReason && (
                        <span className="ml-2 text-xs font-normal text-subtle">{mv.skipReason}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {hit?.top[0]?.san ?? "—"}
                      {hit && hit.match > 0 && (
                        <span className="ml-1 text-good">T{hit.match}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
