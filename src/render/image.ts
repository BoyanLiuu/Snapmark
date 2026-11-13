import type { Frame } from "./view";

/**
 * The image itself, on the base layer, in image px. Above 200% its pixels show as squares, so a
 * one-pixel border can be boxed; below, smoothing keeps downscaled text readable (ARCHITECTURE.md §4).
 */
export const drawImageLayer = (
  ctx: CanvasRenderingContext2D,
  { camera }: Frame,
  bitmap: ImageBitmap,
) => {
  // A closed bitmap has no size; a frame drawn as the image is put away just skips it.
  if (bitmap.width === 0) return;
  ctx.imageSmoothingEnabled = camera.scale <= 2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0);
};
