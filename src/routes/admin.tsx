import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ReportCard } from "@/components/fairplay/ReportCard";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { verdictLabel } from "@/lib/fairplay/score";
import type { ScanReport } from "@/lib/fairplay/types";
import {
  claimAdminDesk,
  decideFairPlayCase,
  getFairPlayMe,
  listFairPlayCases,
  listFairPlayPlayers,
  restorePlayer,
  type FairPlayCaseRow,
  type FairPlayMe,
  type FairPlayPlayerRow,
} from "@/lib/server/fairplay";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function tone(status: string) {
  if (status === "pending") return "warn" as const;
  if (status === "suspended") return "danger" as const;
  if (status === "watch") return "accent" as const;
  if (status === "restored") return "good" as const;
  return "muted" as const;
}

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<FairPlayMe | null>(null);
  const [cases, setCases] = useState<FairPlayCaseRow[]>([]);
  const [players, setPlayers] = useState<FairPlayPlayerRow[]>([]);
  const [tab, setTab] = useState<"cases" | "players">("cases");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<FairPlayCaseRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const status = await getFairPlayMe();
    setMe(status);
    if (!status.isAdmin) {
      setCases([]);
      setPlayers([]);
      return;
    }
    const [rows, roster] = await Promise.all([listFairPlayCases(), listFairPlayPlayers()]);
    setCases(rows);
    setPlayers(roster);
  }

  useEffect(() => {
    if (!user) return;
    void reload().catch((e) => setErr(e instanceof Error ? e.message : "Could not load desk"));
  }, [user]);

  if (isPending) return <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-elevated" />;
  if (!user) return <RedirectToSignIn />;

  const report = open?.scan?.report as ScanReport | null | undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">Steward</p>
          <h1 className="font-display text-3xl">Fair Play desk</h1>
          <p className="mt-1 max-w-xl text-muted">
            Stockfish scans set the evidence. You decide — approve a suspension, restore a player,
            keep them on watch, or dismiss.
          </p>
        </div>
        <Link to="/fair-play" className="text-sm text-muted underline-offset-4 hover:underline">
          Scanner
        </Link>
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}

      {me && !me.isAdmin && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-[var(--radius-md)] bg-elevated">
              <Scale className="size-5" />
            </div>
            <div>
              <div className="font-medium">
                {me.canClaimAdmin ? "This court has no steward yet." : "The desk is seated."}
              </div>
              <p className="text-sm text-muted">
                {me.canClaimAdmin
                  ? "Claim it to review flags and approve suspensions."
                  : "Only the sitting steward can suspend a player."}
              </p>
            </div>
          </div>
          {me.canClaimAdmin && (
            <Button
              className="mt-4"
              onClick={() => {
                void claimAdminDesk()
                  .then(() => {
                    toast.success("You hold the desk.");
                    return reload();
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Could not claim"));
              }}
            >
              Claim the desk
            </Button>
          )}
        </div>
      )}

      {me?.isAdmin && (
        <>
          <div className="flex gap-2">
            {(
              [
                ["cases", "Cases"],
                ["players", "Flagged players"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "h-11 rounded-[var(--radius-sm)] border px-4 text-sm",
                  tab === id ? "border-accent bg-elevated" : "border-border bg-surface",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "cases" && (
            <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
              {cases.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted">
                  No cases yet. Run a scan that flags, or report an opponent.
                </li>
              )}
              {cases.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Badge tone={tone(c.status)}>{c.status}</Badge>
                  {c.kind === "report" && <Badge tone="accent">report</Badge>}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {c.displayName} · risk {c.risk} · {verdictLabel(c.verdict)}
                    </div>
                    <div className="text-xs text-subtle">
                      vs {c.opponent || "unknown"}
                      {c.scan
                        ? ` · SF ${Math.round((c.scan.stockfishTop1 ?? 0) * 100)}%`
                        : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setOpen(c);
                      setNote(c.adminNote ?? "");
                    }}
                  >
                    Review
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {tab === "players" && (
            <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
              {players.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted">No flagged accounts.</li>
              )}
              {players.map((p) => (
                <li key={p.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Badge tone={p.status === "suspended" ? "danger" : "warn"}>{p.status}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.displayName}</div>
                    <div className="text-xs text-subtle">
                      Rating {p.rating}
                      {p.score != null ? ` · integrity ${p.score}` : ""}
                      {p.suspendReason ? ` · ${p.suspendReason}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void restorePlayer({ data: { userId: p.userId, note: "Restored from roster." } })
                        .then(() => {
                          toast.success(`${p.displayName} restored.`);
                          return reload();
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
                    }}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Dialog
        open={!!open}
        onOpenChange={(v) => {
          if (!v) setOpen(null);
        }}
      >
        <DialogContent title="Case review" className="max-h-[90dvh] w-[min(100%-2rem,720px)] overflow-y-auto">
          {open && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted">
                {open.displayName} vs {open.opponent || "unknown"} · risk {open.risk}
                {open.kind === "report" ? " · filed as a report" : " · auto scan"}
              </p>
              {report && <ReportCard report={report} />}
              <div className="space-y-1.5">
                <Label htmlFor="note">Steward note</Label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={280}
                  className="min-h-20 w-full rounded-[var(--radius-sm)] border border-border bg-elevated p-3 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || open.status === "suspended"}
                  variant="danger"
                  onClick={() => {
                    if (!open) return;
                    setBusy(true);
                    void decideFairPlayCase({ data: { caseId: open.id, action: "suspend", note } })
                      .then(() => {
                        toast.success("Suspension approved.");
                        setOpen(null);
                        return reload();
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                      .finally(() => setBusy(false));
                  }}
                >
                  Approve suspension
                </Button>
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={() => {
                    if (!open) return;
                    setBusy(true);
                    void decideFairPlayCase({ data: { caseId: open.id, action: "watch", note } })
                      .then(() => {
                        toast.success("Kept on watch.");
                        setOpen(null);
                        return reload();
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                      .finally(() => setBusy(false));
                  }}
                >
                  Keep on watch
                </Button>
                <Button
                  disabled={busy}
                  variant="ghost"
                  onClick={() => {
                    if (!open) return;
                    setBusy(true);
                    void decideFairPlayCase({ data: { caseId: open.id, action: "dismiss", note } })
                      .then(() => {
                        toast.success("Case dismissed.");
                        setOpen(null);
                        return reload();
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                      .finally(() => setBusy(false));
                  }}
                >
                  Dismiss
                </Button>
                {(open.status === "suspended" || open.status === "watch") && (
                  <Button
                    disabled={busy}
                    variant="secondary"
                    onClick={() => {
                      if (!open) return;
                      setBusy(true);
                      void decideFairPlayCase({ data: { caseId: open.id, action: "restore", note } })
                        .then(() => {
                          toast.success("Player restored.");
                          setOpen(null);
                          return reload();
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                        .finally(() => setBusy(false));
                    }}
                  >
                    Restore account
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
