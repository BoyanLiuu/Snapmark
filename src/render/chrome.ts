/**
 * The canvas chrome's colours, taken from the page itself so the crosshair, the selection and the
 * gutter follow the theme (lib/theme.ts). Read once and kept until the theme changes, because a
 * computed style on every frame would mean a style recalculation on every frame.
 *
 * The annotations are not in here: their colours are content (model/palette.ts) and the plate
 * behind a label is part of what the export holds, so neither moves with the theme.
 */

import { onThemeChange } from "@/lib/theme";

export interface Chrome {
  /** The pointer's crosshair. */
  guide: string;
  /** The selection, its handles and its tag. */
  accent: string;
  /** Text on the accent. */
  accentInk: string;
  /** The plate a handle or a tag sits on. */
  paper: string;
  /** The pointer drawn on the open screen's figure. */
  ink: string;
  /** The marquee's fill. */
  marquee: string;
  /** Outside the image, where the export will cut. */
  gutter: string;
}

const DARK: Chrome = {
  guide: "oklch(50% 0.01 80)",
  accent: "oklch(72% 0.17 45)",
  accentInk: "oklch(10% 0.02 45)",
  paper: "oklch(9% 0.008 75)",
  ink: "oklch(94% 0.01 80)",
  marquee: "oklch(72% 0.17 45 / 0.08)",
  gutter: "oklch(6.5% 0.007 75 / 0.72)",
};

let cached: Chrome | null = null;

const read = (): Chrome => {
  if (typeof document === "undefined") return DARK;
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const accent = token("--primary", DARK.accent);
  const paper = token("--background", DARK.paper);
  return {
    guide: token("--muted-2", DARK.guide),
    accent,
    accentInk: token("--primary-foreground", DARK.accentInk),
    paper,
    ink: token("--foreground", DARK.ink),
    marquee: `color-mix(in oklab, ${accent} 10%, transparent)`,
    gutter: `color-mix(in oklab, ${token("--paper-3", DARK.paper)} 72%, transparent)`,
  };
};

// The page is rendered on the server too, where there is no theme to change.
if (typeof window !== "undefined")
  onThemeChange(() => {
    cached = null;
  });

export const chrome = (): Chrome => (cached ??= read());
