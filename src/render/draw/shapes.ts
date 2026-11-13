/** Rectangles, arrows and highlights, in image px. `minStroke` keeps hairlines visible when zoomed out. */

import { arrowGeometry } from "@/geom/arrow";
import { swatch } from "@/model/palette";
import type { ArrowA, HighlightA, RectA } from "@/model/types";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const drawRect = (ctx: Ctx, a: RectA, minStroke: number) => {
  ctx.globalAlpha = a.opacity;
  ctx.strokeStyle = swatch(a.color).css;
  ctx.lineWidth = Math.max(a.strokeWidth, minStroke);
  ctx.lineJoin = "miter";
  ctx.strokeRect(a.x, a.y, a.w, a.h);
};

export const drawArrow = (ctx: Ctx, a: ArrowA, minStroke: number) => {
  const { shaftEnd, head } = arrowGeometry(a);
  const colour = swatch(a.color).css;
  ctx.globalAlpha = a.opacity;
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(a.strokeWidth, minStroke);
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(a.x1, a.y1);
  ctx.lineTo(shaftEnd.x, shaftEnd.y);
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(head[0].x, head[0].y);
  ctx.lineTo(head[1].x, head[1].y);
  ctx.lineTo(head[2].x, head[2].y);
  ctx.closePath();
  ctx.fill();
};

/** Multiply, like a marker: the image under it stays readable (ARCHITECTURE.md §5). */
export const drawHighlight = (ctx: Ctx, a: HighlightA) => {
  ctx.globalAlpha = a.opacity;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = swatch(a.color).css;
  ctx.fillRect(a.x, a.y, a.w, a.h);
};
