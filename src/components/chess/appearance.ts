import { useEffect } from "react";
import { ROLES } from "chessops/types";
import type { BoardStyleId, Side } from "@/lib/chess/types";
import { pieceSetById, pieceUrl, type PieceSetId } from "@/lib/chess/pieceSets";
import { APPEARANCE_DEFAULTS, useSettings } from "@/lib/store/settings";
import { useHydrated } from "@/lib/use-hydrated";
import { activeBoardStyle } from "./captureFx";

/** The player's piece set, or the default until hydration is done. */
export function useActivePieceSet(): PieceSetId {
  const stored = useSettings((s) => s.pieceSet);
  const hydrated = useHydrated();
  return hydrated ? pieceSetById(stored).id : APPEARANCE_DEFAULTS.pieceSet;
}

/** The board style in use, or the default until hydration is done. */
export function useActiveBoardStyle(): BoardStyleId {
  const theme = useSettings((s) => s.theme);
  const boardStyle = useSettings((s) => s.boardStyle);
  const lock = useSettings((s) => s.lockThemeAssets);
  const hydrated = useHydrated();
  const d = APPEARANCE_DEFAULTS;
  return hydrated
    ? activeBoardStyle(theme, boardStyle, lock)
    : activeBoardStyle(d.theme, d.boardStyle, d.lockThemeAssets);
}

/** Warm the image cache for a set so captures, drags and promotions never flash. */
export function usePreloadPieceSet(set: PieceSetId) {
  useEffect(() => {
    if (set === "chessmess" || typeof Image === "undefined") return;
    for (const color of ["white", "black"] as Side[]) {
      for (const role of ROLES) {
        const img = new Image();
        img.src = pieceUrl(set, color, role);
      }
    }
  }, [set]);
}
