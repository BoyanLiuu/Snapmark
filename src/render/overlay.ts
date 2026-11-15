/**
 * The overlay layer, drawn in screen px so its marks keep their size at any zoom: the crosshair at
 * the pointer, the selection with its handles and size tag, and the design file's pixel mark.
 */

import { toScreen } from "@/geom/matrix";
import { HANDLE_SIZE } from "@/geom/handles";
import type { Box } from "@/model/bbox";
import type { Point } from "@/model/types";
import { chrome } from "./chrome";
import type { Frame } from "./view";

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
  ctx.strokeStyle = chrome().guide;
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
  ctx.strokeStyle = chrome().accent;
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

/**
 * The selection (screens 13, 20): an outline round a box (none round an arrow, whose line is its
 * own outline), its handles, and its size on a tag below.
 */
export const drawSelection = (
  ctx: CanvasRenderingContext2D,
  { camera, size }: Frame,
  { box, handles, tag }: { box: Box | null; handles: Point[]; tag: string },
) => {
  const snap = (p: Point) => {
    const s = toScreen(camera, p);
    return { x: hairline(s.x, size.dpr), y: hairline(s.y, size.dpr) };
  };
  const points = handles.map((p) => toScreen(camera, p));
  const { accent, accentInk, paper } = chrome();
  ctx.strokeStyle = accent;

  let mid: number;
  let bottom: number;
  if (box) {
    const a = snap({ x: box.x, y: box.y });
    const b = snap({ x: box.x + box.w, y: box.y + box.h });
    ctx.lineWidth = 1 / size.dpr;
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    mid = (a.x + b.x) / 2;
    bottom = b.y;
  } else {
    mid = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    bottom = Math.max(...points.map((p) => p.y));
  }

  ctx.fillStyle = paper;
  ctx.lineWidth = 1;
  for (const c of points) {
    const left = Math.round(c.x - HANDLE_SIZE / 2);
    const top = Math.round(c.y - HANDLE_SIZE / 2);
    ctx.fillRect(left, top, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeRect(left + 0.5, top + 0.5, HANDLE_SIZE - 1, HANDLE_SIZE - 1);
  }

  ctx.font = TAG_FONT;
  const w = Math.ceil(ctx.measureText(tag).width) + 12;
  const h = 20;
  const top = Math.round(bottom + HANDLE_SIZE);
  ctx.fillStyle = accent;
  ctx.fillRect(Math.round(mid - w / 2), top, w, h);
  ctx.fillStyle = accentInk;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, mid, top + h / 2);
};

/** One member of a multi-selection, or what a marquee would pick: a dashed outline (screen 16). */
export const drawMember = (
  ctx: CanvasRenderingContext2D,
  { camera, size }: Frame,
  box: Box,
) => {
  const a = toScreen(camera, { x: box.x, y: box.y });
  const b = toScreen(camera, { x: box.x + box.w, y: box.y + box.h });
  ctx.save();
  ctx.strokeStyle = chrome().accent;
  ctx.lineWidth = 1 / size.dpr;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(
    hairline(a.x, size.dpr),
    hairline(a.y, size.dpr),
    b.x - a.x,
    b.y - a.y,
  );
  ctx.restore();
};

/** The marquee being dragged on empty ground (screen 15). */
export const drawMarquee = (
  ctx: CanvasRenderingContext2D,
  { camera, size }: Frame,
  box: Box,
) => {
  const a = toScreen(camera, { x: box.x, y: box.y });
  const b = toScreen(camera, { x: box.x + box.w, y: box.y + box.h });
  const { accent, marquee } = chrome();
  ctx.fillStyle = marquee;
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1 / size.dpr;
  ctx.strokeRect(
    hairline(a.x, size.dpr),
    hairline(a.y, size.dpr),
    b.x - a.x,
    b.y - a.y,
  );
};

/** The stage outside the image, dimmed, so what the PNG will cut off looks cut off (screen 19). */
export const drawGutter = (
  ctx: CanvasRenderingContext2D,
  { camera, size }: Frame,
  natural: { w: number; h: number },
) => {
  const a = toScreen(camera, { x: 0, y: 0 });
  const b = toScreen(camera, { x: natural.w, y: natural.h });
  ctx.fillStyle = chrome().gutter;
  ctx.beginPath();
  ctx.rect(0, 0, size.cssW, size.cssH);
  ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.fill("evenodd");
};

/**
 * The pointer that annotates the open screen's figure (components/open/intro.ts): the select
 * tool's own arrow, drawn at a constant size in screen px, and pressed while it drags.
 */
export const drawPointer = (
  ctx: CanvasRenderingContext2D,
  { camera }: Frame,
  p: Point,
  { pressed, alpha }: { pressed: boolean; alpha: number },
) => {
  const { x, y } = toScreen(camera, p);
  const { accent, ink, paper } = chrome();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  // Pressed: a ring around the tip, as a click looks in the design file's own cursor.
  if (pressed) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 17);
  ctx.lineTo(4.4, 12.6);
  ctx.lineTo(7.4, 19.4);
  ctx.lineTo(10.2, 18.2);
  ctx.lineTo(7.2, 11.4);
  ctx.lineTo(13.4, 10.8);
  ctx.closePath();
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
};

/** The caret, while the figure's label types itself: one bar at the end of what has been typed. */
export const drawCaret = (
  ctx: CanvasRenderingContext2D,
  { camera }: Frame,
  p: Point,
  height: number,
) => {
  const { x, y } = toScreen(camera, p);
  ctx.fillStyle = chrome().accent;
  ctx.fillRect(
    Math.round(x),
    Math.round(y),
    2,
    Math.max(6, height * camera.scale),
  );
};
