/**
 * The overlay layer, drawn in screen px so its marks keep their size at any zoom: the crosshair at
 * the pointer, the selection with its handles and size tag, and the design file's pixel mark.
 */

import { toScreen } from "@/geom/matrix";
import { HANDLE_SIZE, HANDLES, handlePoint } from "@/geom/resize";
import type { Box } from "@/model/bbox";
import type { Point } from "@/model/types";
import type { Frame } from "./view";

const GUIDE = "oklch(50% 0.01 80)";
const ACCENT = "oklch(72% 0.17 45)";
const ACCENT_INK = "oklch(10% 0.02 45)";
const PAPER = "oklch(9% 0.008 75)";
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

/** The selection (screen 13): outline, handles where it can be resized, and its size on a tag. */
export const drawSelection = (
  ctx: CanvasRenderingContext2D,
  { camera, size }: Frame,
  box: Box,
  tag: string,
  handles: boolean,
) => {
  const snap = (p: { x: number; y: number }) => {
    const s = toScreen(camera, p);
    return { x: hairline(s.x, size.dpr), y: hairline(s.y, size.dpr) };
  };
  const a = snap({ x: box.x, y: box.y });
  const b = snap({ x: box.x + box.w, y: box.y + box.h });

  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1 / size.dpr;
  ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

  if (handles) {
    ctx.fillStyle = PAPER;
    ctx.lineWidth = 1;
    for (const h of HANDLES) {
      const c = toScreen(camera, handlePoint(box, h));
      const left = Math.round(c.x - HANDLE_SIZE / 2);
      const top = Math.round(c.y - HANDLE_SIZE / 2);
      ctx.fillRect(left, top, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(left + 0.5, top + 0.5, HANDLE_SIZE - 1, HANDLE_SIZE - 1);
    }
  }

  ctx.font = TAG_FONT;
  const mid = (a.x + b.x) / 2;
  const w = Math.ceil(ctx.measureText(tag).width) + 12;
  const h = 20;
  const top = Math.round(b.y + HANDLE_SIZE);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(Math.round(mid - w / 2), top, w, h);
  ctx.fillStyle = ACCENT_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, mid, top + h / 2);
};
