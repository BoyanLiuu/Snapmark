/**
 * Text on canvas: greedy word wrap against the annotation's width, on a dark plate so it reads on
 * any photo (ARCHITECTURE.md §8). Measured in the font's own units, which are image px, so the view
 * and the export wrap identically. M13 adds the measure cache and the editing overlay.
 */

import { swatch } from "@/model/palette";
import type { TextA } from "@/model/types";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A system stack, so there is nothing to load before measuring. */
const STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const LINE = 1.25;
const PLATE = "oklch(9% 0.008 75 / 0.74)";

export const fontFor = (a: TextA) => `600 ${a.fontSize}px ${STACK}`;

export const wrapText = (ctx: Ctx, a: TextA) => {
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

export const drawText = (ctx: Ctx, a: TextA) => {
  const { lines, widest, lineHeight } = wrapText(ctx, a);
  ctx.globalAlpha = a.opacity;
  if (a.plate) {
    const pad = a.fontSize * 0.35;
    ctx.fillStyle = PLATE;
    ctx.fillRect(
      a.x - pad,
      a.y - pad,
      widest + 2 * pad,
      lines.length * lineHeight + 2 * pad,
    );
  }
  ctx.fillStyle = swatch(a.color).css;
  ctx.textBaseline = "middle";
  lines.forEach((line, i) =>
    ctx.fillText(line, a.x, a.y + (i + 0.5) * lineHeight),
  );
};
