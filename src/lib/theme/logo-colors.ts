import { BRAND_LOGO_COLORS } from "@/lib/theme/logo-mark";

export type LogoColors = { fill: string; bg: string };

/** Fixed brand colors — logo is not recolored per theme. */
export const LOGO_THEME_COLORS = BRAND_LOGO_COLORS satisfies LogoColors;

export function faviconDataUrl(): string {
  return "/favicon.png";
}
