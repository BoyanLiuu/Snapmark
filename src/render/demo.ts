/**
 * M0's stand-in scene, drawn until there is an image to draw (M2 replaces it with a sample image).
 *
 * The base layer gets a hard-coded square: if the canvas were stretched it would not be square,
 * and its inner hairline is exactly one device pixel wide, so a wrong pixel ratio shows as a grey
 * smear instead of a sharp line. The overlay gets corner handles and a crosshair at the pointer.
 */

import type { ViewSize } from "./view";

export interface Point {
  x: number;
  y: number;
}

// Snapmark tokens (src/app/globals.css). Canvas cannot read CSS variables.
const ACCENT = "oklch(72% 0.17 45)";
const INK_2 = "oklch(84% 0.011 80)";
const PAPER = "oklch(9% 0.008 75)";
const MUTED_2 = "oklch(50% 0.01 80)";

const SIDE = 240;
const HAIRLINE_INSET = 24;
/** Handles are a fixed size in CSS px, whatever the zoom (ARCHITECTURE.md §1). */
const HANDLE = 8;

/** The square, centred and on whole CSS px so its edges land on whole device px. */
export const demoSquare = ({ cssW, cssH }: ViewSize) => ({
  x: Math.round((cssW - SIDE) / 2),
  y: Math.round((cssH - SIDE) / 2),
  w: SIDE,
  h: SIDE,
});

export const drawDemoBase = (ctx: CanvasRenderingContext2D, size: ViewSize) => {
  const { x, y, w, h } = demoSquare(size);
  ctx.fillStyle = INK_2;
  ctx.fillRect(x, y, w, h);

  // A 2 CSS px frame centred on the edge: one CSS px either side, so whole device px at any DPR.
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // One device pixel, centred on a device-pixel boundary + half, so it covers exactly one column.
  const device = 1 / size.dpr;
  const i = HAIRLINE_INSET;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = device;
  ctx.strokeRect(x + i + device / 2, y + i + device / 2, w - 2 * i, h - 2 * i);
};

export const drawDemoOverlay = (
  ctx: CanvasRenderingContext2D,
  size: ViewSize,
  pointer: Point | null,
) => {
  const { x, y, w, h } = demoSquare(size);
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1;
  for (const [cx, cy] of [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ] as const) {
    const left = cx - HANDLE / 2;
    const top = cy - HANDLE / 2;
    ctx.fillRect(left, top, HANDLE, HANDLE);
    ctx.strokeRect(left + 0.5, top + 0.5, HANDLE - 1, HANDLE - 1);
  }

  if (!pointer) return;
  const device = 1 / size.dpr;
  const px = Math.floor(pointer.x) + device / 2;
  const py = Math.floor(pointer.y) + device / 2;
  ctx.strokeStyle = MUTED_2;
  ctx.lineWidth = device;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, size.cssH);
  ctx.moveTo(0, py);
  ctx.lineTo(size.cssW, py);
  ctx.stroke();
};
