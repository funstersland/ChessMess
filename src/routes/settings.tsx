import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/lib/store/settings";
import { BOARD_STYLES, WORLD_THEMES } from "@/lib/theme/themes";
import { playSfx, startThemeMusic, unlockAudio } from "@/lib/audio/sfx";
import { speak } from "@/lib/coach/coach";
import { cn } from "@/lib/utils";
import type { BoardStyleId, WorldThemeId } from "@/lib/chess/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const s = useSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-1 text-muted">Personalise the court, the coach, and the sound.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl">World theme</h2>
        <p className="text-sm text-muted">
          Royal, wood, ice, noir, forest, ocean, ivory, and paper — each world sets mood, sound, and
          default board.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORLD_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                s.setTheme(t.id as WorldThemeId);
                unlockAudio();
                playSfx("click", t.id);
                startThemeMusic(t.id, s.music && s.sound);
              }}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-3 text-left",
                s.theme === t.id ? "border-accent bg-elevated" : "border-border bg-surface",
              )}
            >
              <div className="text-sm font-medium">{t.name}</div>
              <p className="mt-1 text-xs text-subtle">{t.line}</p>
            </button>
          ))}
        </div>
        <Row label="Sync board with world theme">
          <Switch
            checked={s.lockThemeAssets}
            onCheckedChange={(v) => s.set({ lockThemeAssets: v })}
          />
        </Row>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Board</h2>
        <p className="text-sm text-muted">
          Each board has its own look — wood grain, ice crystal, forest marble, rain-slick ocean,
          aged paper, ivory, royal red, or noir pearl.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BOARD_STYLES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => s.set({ boardStyle: b.id as BoardStyleId, lockThemeAssets: false })}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors",
                s.boardStyle === b.id ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface",
              )}
            >
              <div className="text-sm font-medium">{b.name}</div>
              <p className={cn("mt-1 text-xs", s.boardStyle === b.id ? "text-accent-fg/80" : "text-subtle")}>
                {b.line}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Play</h2>
        <Row label="Show coordinates">
          <Switch checked={s.showCoords} onCheckedChange={(v) => s.set({ showCoords: v })} />
        </Row>
        <Row label="Show captured pieces">
          <Switch checked={s.showCaptured} onCheckedChange={(v) => s.set({ showCaptured: v })} />
        </Row>
        <Row label="Mark last move of both sides">
          <Switch checked={s.markLastMove} onCheckedChange={(v) => s.set({ markLastMove: v })} />
        </Row>
        <Row label="Highlight legal moves">
          <Switch checked={s.highlightLegal} onCheckedChange={(v) => s.set({ highlightLegal: v })} />
        </Row>
        <Row label="Hints vs bots (never vs a friend)">
          <Switch checked={s.hints} onCheckedChange={(v) => s.set({ hints: v })} />
        </Row>
        <Row label="Auto-flip in pass-and-play">
          <Switch checked={s.autoFlip} onCheckedChange={(v) => s.set({ autoFlip: v })} />
        </Row>
        <Row label="Board juice">
          <Switch checked={s.animations} onCheckedChange={(v) => s.set({ animations: v })} />
        </Row>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Sound</h2>
        <Row label="Sound">
          <Switch checked={s.sound} onCheckedChange={(v) => s.set({ sound: v })} />
        </Row>
        <Row label="Theme music">
          <Switch checked={s.music} onCheckedChange={(v) => s.set({ music: v })} />
        </Row>
        <div className="space-y-1">
          <Label>Master</Label>
          <Slider value={s.masterVol} onValueChange={(v) => s.set({ masterVol: v })} />
        </div>
        <div className="space-y-1">
          <Label>Moves</Label>
          <Slider value={s.sfxVol} onValueChange={(v) => s.set({ sfxVol: v })} />
        </div>
        <div className="space-y-1">
          <Label>Music</Label>
          <Slider value={s.musicVol} onValueChange={(v) => s.set({ musicVol: v })} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Coach</h2>
        <Row label="Coach">
          <Switch checked={s.coachOn} onCheckedChange={(v) => s.set({ coachOn: v })} />
        </Row>
        <Row label="Teach right after a mistake">
          <Switch checked={s.teachOnMistake} onCheckedChange={(v) => s.set({ teachOnMistake: v })} />
        </Row>
        <div className="flex gap-2">
          {(["female", "male"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                s.set({ coachVoice: g });
                speak("I'll keep watch over this board.", {
                  gender: g,
                  volume: s.coachVol,
                  rate: s.coachRate,
                  enabled: s.coachOn && s.sound,
                });
              }}
              className={cn(
                "h-11 rounded-[var(--radius-md)] border px-4 text-sm capitalize",
                s.coachVoice === g ? "border-accent bg-accent text-accent-fg" : "border-border bg-elevated",
              )}
            >
              {g} voice
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label>Coach volume</Label>
          <Slider value={s.coachVol} onValueChange={(v) => s.set({ coachVol: v })} />
        </div>
        <div className="space-y-1">
          <Label>Speaking rate</Label>
          <Slider
            value={s.coachRate}
            min={0.7}
            max={1.3}
            step={0.05}
            onValueChange={(v) => s.set({ coachRate: v })}
          />
        </div>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-14 items-center justify-between gap-4 border-b border-border">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
