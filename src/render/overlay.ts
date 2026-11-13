/**
 * The overlay layer, drawn in screen px so its marks keep their size at any zoom. For now a
 * crosshair at the pointer; selection, handles, the marquee and the draft join it from M5.
 */

import type { Point } from "@/model/types";
import type { Frame } from "./view";

const GUIDE = "oklch(50% 0.01 80)";

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
