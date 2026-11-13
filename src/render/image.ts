import type { Doc } from "@/model/types";
import { drawScene } from "./scene";
import type { Frame } from "./view";

/**
 * The base layer: the scene through the view's camera. Above 200% the image's pixels show as
 * squares, so a one-pixel border can be boxed; below, smoothing keeps downscaled text readable
 * (ARCHITECTURE.md §4). A stroke never thins below one screen pixel.
 */
export const drawImageLayer = (
  ctx: CanvasRenderingContext2D,
  { camera }: Frame,
  doc: Doc,
  bitmap: ImageBitmap,
) => {
  ctx.imageSmoothingEnabled = camera.scale <= 2;
  ctx.imageSmoothingQuality = "high";
  drawScene(ctx, doc, bitmap, { minVisualStroke: 1 / camera.scale });
};
