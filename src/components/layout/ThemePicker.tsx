import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { WORLD_THEMES } from "@/lib/theme/themes";
import { useSettings } from "@/lib/store/settings";
import { playSfx, startThemeMusic, unlockAudio } from "@/lib/audio/sfx";
import { cn } from "@/lib/utils";
import type { WorldThemeId } from "@/lib/chess/types";

export function ThemePicker() {
  const navigate = useNavigate();
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const music = useSettings((s) => s.music);
  const sound = useSettings((s) => s.sound);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const updatePanelPos = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setPanelPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    updatePanelPos();
    const onResize = () => updatePanelPos();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (id: WorldThemeId) => {
    setTheme(id);
    unlockAudio();
    playSfx("click", id);
    startThemeMusic(id, music && sound);
    setOpen(false);
    void navigate({ to: "/" });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (!open) updatePanelPos();
          setOpen((v) => !v);
        }}
        className="relative inline-flex size-11 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-elevated hover:text-fg"
        aria-label="Personalize world"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Palette className="size-4" />
        <span
          className={cn("absolute right-1.5 bottom-1.5 size-2 rounded-full ring-2 ring-bg", `cm-swatch-${theme}`)}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="World themes"
          style={{ top: panelPos.top, right: panelPos.right }}
          className="fixed z-[100] w-[min(calc(100vw-2rem),22rem)] rounded-[var(--radius-lg)] border border-border bg-elevated p-3 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
        >
          <p className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">Worlds</p>
          <div className="grid grid-cols-2 gap-1.5">
            {WORLD_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={theme === t.id}
                onClick={() => pick(t.id)}
                className={cn(
                  "rounded-[var(--radius-sm)] border px-2.5 py-2 text-left transition-colors",
                  theme === t.id ? "border-accent bg-surface" : "border-border bg-bg hover:bg-surface",
                )}
              >
                <span className={cn("mb-1.5 block h-1 rounded-full", `cm-swatch-${t.id}`)} />
                <span className="text-sm font-medium">{t.name}</span>
                <span className="mt-0.5 line-clamp-1 text-[11px] text-subtle">{t.line}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
