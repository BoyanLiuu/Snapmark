/**
 * The overlay layer, drawn in screen px so its marks keep their size at any zoom. For now a
 * crosshair at the pointer; selection, handles, the marquee and the draft join it from M5.
 */

import { toScreen } from "@/geom/matrix";
import type { Point } from "@/model/types";
import type { Frame } from "./view";

const GUIDE = "oklch(50% 0.01 80)";
const ACCENT = "oklch(72% 0.17 45)";

export const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  { size }: Frame,
  pointer: Point | null,
) => {
  if (!pointer) return;
  // One device pixel, centred on a device pixel, so the guide is a hairline at any ratio.
  const device = 1 / size.dpr;
  const x = Math.floor(pointer.x) + device / 2;
  const y = Math.floor(pointer.y) + device / 2;
  ctx.strokeStyle = GUIDE;
  ctx.lineWidth = device;
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
