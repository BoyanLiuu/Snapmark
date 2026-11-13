/**
 * The overlay layer, drawn in screen px so its marks keep their size at any zoom: the crosshair at
 * the pointer, the selection with its handles and size tag, and the design file's pixel mark.
 */

import { toScreen } from "@/geom/matrix";
import type { Box } from "@/model/bbox";
import type { Point } from "@/model/types";
import type { Frame } from "./view";

const GUIDE = "oklch(50% 0.01 80)";
const ACCENT = "oklch(72% 0.17 45)";
const ACCENT_INK = "oklch(10% 0.02 45)";
const PAPER = "oklch(9% 0.008 75)";
/** Screen px at any zoom (ARCHITECTURE.md §1). */
const HANDLE = 8;
const TAG_FONT = "500 12px ui-monospace, SFMono-Regular, Menlo, monospace";

/** A coordinate on the centre of a device pixel, so a one-device-pixel line is a hairline. */
const hairline = (v: number, dpr: number) =>
  Math.round(v * dpr) / dpr + 1 / dpr / 2;

export const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  { size }: Frame,
  pointer: Point | null,
) => {
  if (!pointer) return;
  const x = hairline(pointer.x, size.dpr);
  const y = hairline(pointer.y, size.dpr);
  ctx.strokeStyle = GUIDE;
  ctx.lineWidth = 1 / size.dpr;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, size.cssH);
  ctx.moveTo(0, y);
  ctx.lineTo(size.cssW, y);
  ctx.stroke();
};

/**
 * The design file's pixel mark: a 10 px box centred on an image point, with ticks out from each
 * side. Sized in screen px, so it reads the same at any zoom.
 */
export const drawMark = (
  ctx: CanvasRenderingContext2D,
  { camera }: Frame,
  p: Point,
) => {
  const { x, y } = toScreen(camera, p);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 5, y - 5, 10, 10);
  ctx.beginPath();
  ctx.moveTo(x - 23, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 23, y);
  ctx.moveTo(x, y - 23);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y + 23);
  ctx.stroke();
};

/** The selection (screen 13): outline, eight handles, and its size on a tag beneath. */
export const drawSelection = (
  ctx: CanvasRenderingContext2D,
  { camera, size }: Frame,
  box: Box,
  tag: string,
) => {
  const snap = (v: number) => hairline(v, size.dpr);
  const a = toScreen(camera, { x: box.x, y: box.y });
  const b = toScreen(camera, { x: box.x + box.w, y: box.y + box.h });
  const [x0, y0, x1, y1] = [snap(a.x), snap(a.y), snap(b.x), snap(b.y)];
  const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];

  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1 / size.dpr;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

  ctx.fillStyle = PAPER;
  ctx.lineWidth = 1;
  for (const [hx, hy] of [
    [x0, y0],
    [mx, y0],
    [x1, y0],
    [x1, my],
    [x1, y1],
    [mx, y1],
    [x0, y1],
    [x0, my],
  ]) {
    const left = Math.round(hx - HANDLE / 2);
    const top = Math.round(hy - HANDLE / 2);
    ctx.fillRect(left, top, HANDLE, HANDLE);
    ctx.strokeRect(left + 0.5, top + 0.5, HANDLE - 1, HANDLE - 1);
  }

  ctx.font = TAG_FONT;
  const w = Math.ceil(ctx.measureText(tag).width) + 12;
  const h = 20;
  const top = Math.round(y1 + HANDLE);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(Math.round(mx - w / 2), top, w, h);
  ctx.fillStyle = ACCENT_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, mx, top + h / 2);
};
