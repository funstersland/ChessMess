import { useEffect, type ReactNode } from "react";
import { setVolumes, startThemeMusic, unlockAudio } from "@/lib/audio/sfx";
import { themeById } from "@/lib/theme/themes";
import { useSettings } from "@/lib/store/settings";
import { ThemeFx } from "@/components/chess/ThemeFx";
import { faviconDataUrl, LOGO_THEME_COLORS } from "@/lib/theme/logo-colors";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const s = useSettings();

  useEffect(() => {
    const board = s.lockThemeAssets ? themeById(s.theme).defaultBoard : s.boardStyle;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.dataset.board = board;
  }, [s.theme, s.boardStyle, s.lockThemeAssets]);

  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (icon) icon.href = faviconDataUrl();
    const themeColor = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    if (themeColor) themeColor.content = LOGO_THEME_COLORS.bg;
  }, []);

  useEffect(() => {
    setVolumes({
      master: s.masterVol,
      music: s.musicVol,
      sfx: s.sfxVol,
      coach: s.coachVol,
      muted: !s.sound,
    });
  }, [s.masterVol, s.musicVol, s.sfxVol, s.coachVol, s.sound]);

  useEffect(() => {
    const start = () => startThemeMusic(s.theme, s.music && s.sound);
    start();
    const onVis = () => {
      if (document.visibilityState === "visible") start();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [s.theme, s.music, s.sound]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  return (
    <>
      <ThemeFx theme={s.theme} />
      {children}
    </>
  );
}
