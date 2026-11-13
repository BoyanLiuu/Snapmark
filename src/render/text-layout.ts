/**
 * Text layout, measured on one shared offscreen context so the view, the export and hit testing
 * all wrap identically (ARCHITECTURE.md §8). `measureText` reports in the font's own units, which
 * are image px. M13 adds the measure cache.
 */

import type { TextA } from "@/model/types";

/** A system stack, so there is nothing to load before measuring. */
const STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const LINE = 1.25;
/** The legibility plate's margin around the text, as a share of the font size. */
export const PLATE_PAD = 0.35;

export const fontFor = (a: TextA) => `600 ${a.fontSize}px ${STACK}`;

let measurer: OffscreenCanvasRenderingContext2D | null = null;
const measure = () =>
  (measurer ??= new OffscreenCanvas(1, 1).getContext("2d")!);

export interface TextLayout {
  lines: string[];
  widest: number;
  lineHeight: number;
}

/** Greedy word wrap against the annotation's width. */
export const layoutText = (a: TextA): TextLayout => {
  const ctx = measure();
  ctx.font = fontFor(a);
  const lines: string[] = [];
  let line = "";
  for (const word of a.text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > a.width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
  return { lines, widest, lineHeight: a.fontSize * LINE };
};
