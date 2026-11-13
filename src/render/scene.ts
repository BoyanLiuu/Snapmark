/**
 * The scene: the image and its annotations, in image px. The view and the export both call this
 * one function with the same document, so what you see is what the PNG holds by construction
 * (ARCHITECTURE.md §5).
 *
 * Four passes, not one: pixelate reads back the source and must come before anything is drawn over
 * it; highlights multiply, so they go before the opaque marks they would otherwise darken.
 */

import { annotations } from "@/model/doc";
import type { Doc } from "@/model/types";
import { drawPixelate } from "./draw/pixelate";
import { drawArrow, drawHighlight, drawRect } from "./draw/shapes";
import { drawText } from "./draw/text";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface SceneOptions {
  /**
   * The thinnest a stroke may draw, in image px: one screen pixel (1 / scale) in the view, so a
   * stroke never vanishes when zoomed out, and 0 in the export, where a stroke is what it says.
   */
  minVisualStroke: number;
}

export const drawScene = (
  ctx: Ctx,
  doc: Doc,
  bitmap: ImageBitmap,
  opts: SceneOptions,
) => {
  // A closed bitmap has no size; a frame drawn as the image is put away just skips it.
  if (bitmap.width === 0) return;
  const all = annotations(doc);
  const smoothing = ctx.imageSmoothingEnabled;

  ctx.drawImage(bitmap, 0, 0);

  for (const a of all) {
    if (a.kind !== "pixelate") continue;
    ctx.save();
    drawPixelate(ctx, a, bitmap);
    ctx.restore();
  }
  for (const a of all) {
    if (a.kind !== "highlight") continue;
    ctx.save();
    drawHighlight(ctx, a);
    ctx.restore();
  }
  for (const a of all) {
    ctx.save();
    if (a.kind === "rect") drawRect(ctx, a, opts.minVisualStroke);
    else if (a.kind === "arrow") drawArrow(ctx, a, opts.minVisualStroke);
    else if (a.kind === "text") drawText(ctx, a);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = smoothing;
};
