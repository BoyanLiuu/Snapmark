/**
 * Redaction kept live: the region is read back from the source pixels on every draw, scaled down
 * to one sample per block, and drawn back up with smoothing off (ARCHITECTURE.md §5). Reading the
 * bitmap, not the canvas, means nothing drawn on top is ever pixelated.
 */

import type { PixelateA } from "@/model/types";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

let scratch: OffscreenCanvas | null = null;

export const drawPixelate = (ctx: Ctx, a: PixelateA, source: ImageBitmap) => {
  const cols = Math.max(1, Math.round(a.w / a.block));
  const rows = Math.max(1, Math.round(a.h / a.block));
  if (!scratch || scratch.width < cols || scratch.height < rows)
    scratch = new OffscreenCanvas(
      Math.max(cols, scratch?.width ?? 0),
      Math.max(rows, scratch?.height ?? 0),
    );
  const small = scratch.getContext("2d")!;
  small.clearRect(0, 0, cols, rows);
  small.imageSmoothingEnabled = true;
  small.imageSmoothingQuality = "high";
  small.drawImage(source, a.x, a.y, a.w, a.h, 0, 0, cols, rows);
  ctx.globalAlpha = a.opacity;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratch, 0, 0, cols, rows, a.x, a.y, a.w, a.h);
};
