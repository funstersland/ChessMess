import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BoardStyleId, WorldThemeId } from "@/lib/chess/types";
import { DEFAULT_PIECE_SET, type PieceSetId } from "@/lib/chess/pieceSets";
import type { CoachGender } from "@/lib/coach/coach";
import { normalizeBoardStyle, themeById } from "@/lib/theme/themes";

export interface SettingsState {
  theme: WorldThemeId;
  boardStyle: BoardStyleId;
  /** Piece artwork; see `PIECE_SETS`. */
  pieceSet: PieceSetId;
  lockThemeAssets: boolean;
  showCoords: boolean;
  showCaptured: boolean;
  markLastMove: boolean;
  hints: boolean;
  autoFlip: boolean;
  animations: boolean;
  highlightLegal: boolean;
  sound: boolean;
  music: boolean;
  masterVol: number;
  sfxVol: number;
  musicVol: number;
  coachOn: boolean;
  coachVoice: CoachGender;
  coachVol: number;
  coachRate: number;
  teachOnMistake: boolean;
  setTheme: (t: WorldThemeId, syncAssets?: boolean) => void;
  set: (p: Partial<SettingsState>) => void;
}

/**
 * Appearance defaults. The server always renders with these (it cannot see
 * localStorage), so components switch to the stored choice after hydration.
 */
export const APPEARANCE_DEFAULTS = {
  theme: "ivory" as WorldThemeId,
  boardStyle: "ivory" as BoardStyleId,
  lockThemeAssets: true,
  pieceSet: DEFAULT_PIECE_SET,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...APPEARANCE_DEFAULTS,
      showCoords: true,
      showCaptured: true,
      markLastMove: true,
      hints: false,
      autoFlip: false,
      animations: true,
      highlightLegal: true,
      sound: true,
      music: true,
      masterVol: 0.85,
      sfxVol: 0.75,
      musicVol: 0.35,
      coachOn: true,
      coachVoice: "female",
      coachVol: 0.85,
      coachRate: 1,
      teachOnMistake: true,
      setTheme: (theme, syncBoard = get().lockThemeAssets) => {
        const t = themeById(theme);
        set({
          theme,
          ...(syncBoard ? { boardStyle: t.defaultBoard } : {}),
        });
      },
      set: (p) => set(p),
    }),
    {
      name: "chessmess-settings",
      version: 4,
      migrate: (state: unknown, fromVersion: number) => {
        const s = state as SettingsState | undefined;
        if (!s || typeof s !== "object") return state as SettingsState | undefined;
        let next = { ...s } as SettingsState & { pieceSet?: string };
        if (fromVersion < 2) {
          if ((next as { theme?: string }).theme === "fire") {
            next = { ...next, theme: "wood" as WorldThemeId, boardStyle: "wood" };
          }
          if (next.boardStyle) {
            next = { ...next, boardStyle: normalizeBoardStyle(next.boardStyle as string) };
          }
        }
        if (fromVersion < 3 && next.theme) {
          const t = themeById(next.theme as WorldThemeId);
          if (next.lockThemeAssets !== false) {
            next = { ...next, boardStyle: t.defaultBoard, lockThemeAssets: true };
          }
        }
        if (fromVersion < 4) {
          // Pre-v4 piece-set ids belong to an older, removed picker.
          delete (next as { pieceSet?: unknown }).pieceSet;
        }
        return next;
      },
    },
  ),
);
