/**
 * The fixed six-colour palette (the plan's choice: no picker, so no colour decision to make).
 * Annotations store the swatch id; the colour is resolved where it is drawn.
 */

export const SWATCHES = [
  { id: "red", label: "Red", css: "oklch(63% 0.22 27)" },
  { id: "orange", label: "Orange", css: "oklch(72% 0.17 45)" },
  { id: "yellow", label: "Yellow", css: "oklch(89% 0.17 98)" },
  { id: "green", label: "Green", css: "oklch(74% 0.17 150)" },
  { id: "sky", label: "Sky", css: "oklch(74% 0.12 250)" },
  { id: "white", label: "White", css: "oklch(97% 0.006 80)" },
] as const;

export type SwatchId = (typeof SWATCHES)[number]["id"];

export const swatch = (id: SwatchId) => SWATCHES.find((s) => s.id === id)!;
