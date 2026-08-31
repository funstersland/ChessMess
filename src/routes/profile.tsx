import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile, updateMyProfile, type ProfileRow } from "@/lib/server/profile";
import { getFairPlayMe, type FairPlayMe } from "@/lib/server/fairplay";
import { Button } from "@/components/ui/button";
import { ChessMessMark } from "@/components/brand/ChessMessMark";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/lib/store/settings";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const [row, setRow] = useState<ProfileRow | null>(null);
  const [fp, setFp] = useState<FairPlayMe | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  const coachVoice = useSettings((s) => s.coachVoice);
  const setSettings = useSettings((s) => s.set);

  useEffect(() => {
    if (!user) return;
    void getMyProfile()
      .then((p) => {
        setRow(p);
        setName(p.display_name);
        setBio(p.bio);
        if (p.coach_voice === "male" || p.coach_voice === "female") {
          setSettings({ coachVoice: p.coach_voice });
        }
      })
      .catch(() => {});
    void getFairPlayMe()
      .then(setFp)
      .catch(() => setFp(null));
  }, [user, setSettings]);

  if (isPending) {
    return <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-elevated" />;
  }
  if (!user) return <RedirectToSignIn />;

  const games = (row?.wins ?? 0) + (row?.draws ?? 0) + (row?.losses ?? 0);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="flex items-center gap-4">
        {user.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            className="size-16 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ChessMessMark size={64} withBg className="rounded-full" />
        )}
        <div>
          <h1 className="font-display text-3xl">{row?.display_name ?? user.displayName ?? "Player"}</h1>
          <p className="text-sm text-muted">{user.primaryEmail}</p>
          {fp && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                tone={
                  fp.status === "suspended" ? "danger" : fp.status === "flagged" ? "warn" : "good"
                }
              >
                {fp.status === "ok" ? "Fair Play clear" : fp.status}
              </Badge>
              {fp.score != null && <Badge tone="muted">Integrity {fp.score}</Badge>}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Rating", row?.rating ?? 1200],
          ["Peak", row?.peak_rating ?? 1200],
          ["W-D-L", `${row?.wins ?? 0}-${row?.draws ?? 0}-${row?.losses ?? 0}`],
          ["Games", games],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
            <div className="font-display text-lg tabular-nums">{v}</div>
            <div className="text-xs text-subtle">{k}</div>
          </div>
        ))}
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void updateMyProfile({
            data: { displayName: name, bio, coachVoice },
          }).then((p) => {
            setRow(p);
            setSaved(true);
            setTimeout(() => setSaved(false), 1600);
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            value={bio}
            maxLength={280}
            onChange={(e) => setBio(e.target.value)}
            className="min-h-24 w-full rounded-[var(--radius-sm)] border border-border bg-elevated p-3 text-sm text-fg"
          />
        </div>
        <Button type="submit">Save profile</Button>
        {saved && <span className="ml-3 text-sm text-good">Saved</span>}
      </form>

      <Link to="/history" className="inline-block text-sm text-muted underline-offset-4 hover:underline">
        Game history
      </Link>
      <span className="text-subtle"> · </span>
      <Link to="/fair-play" className="inline-block text-sm text-muted underline-offset-4 hover:underline">
        Fair Play
      </Link>
    </div>
  );
}
