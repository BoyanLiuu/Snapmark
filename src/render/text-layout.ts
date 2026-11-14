/**
 * Text layout, measured on one shared offscreen context so the view, the export and hit testing
 * all wrap identically (ARCHITECTURE.md §8). `measureText` reports in the font's own units, which
 * are image px. Widths are cached by font and string: a label redrawn every frame of a drag
 * measures nothing new.
 */

import type { TextA } from "@/model/types";

/** A system stack, so there is nothing to load before measuring. */
export const TEXT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
export const TEXT_WEIGHT = 600;
/** A fixed multiple, so the editing overlay's CSS line-height can match it exactly. */
export const LINE = 1.25;
/** The legibility plate's margin around the text, as a share of the font size. */
export const PLATE_PAD = 0.35;

export const fontFor = (a: TextA) =>
  `${TEXT_WEIGHT} ${a.fontSize}px ${TEXT_STACK}`;

let measurer: OffscreenCanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
const CACHE_LIMIT = 5000;

const widthOf = (font: string, text: string) => {
  const key = `${font}|${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    measurer ??= new OffscreenCanvas(1, 1).getContext("2d")!;
    measurer.font = font;
    width = measurer.measureText(text).width;
    if (widths.size >= CACHE_LIMIT) widths.clear();
    widths.set(key, width);
  }
  return width;
};

export interface TextLayout {
  lines: string[];
  widest: number;
  lineHeight: number;
}

/** Greedy word wrap against the annotation's width. */
export const layoutText = (a: TextA): TextLayout => {
  const font = fontFor(a);
  const lines: string[] = [];
  let line = "";
  for (const word of a.text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && widthOf(font, next) > a.width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const widest = Math.max(0, ...lines.map((l) => widthOf(font, l)));
  return { lines, widest, lineHeight: a.fontSize * LINE };
};
