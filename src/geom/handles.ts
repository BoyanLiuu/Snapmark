/**
 * Handles, per kind: eight on a box, one at each end of an arrow, one on a label's right edge for
 * its wrap width. Drawn and hit at 8 screen px at any zoom, converted to image px where used.
 */

import { outline, type Box } from "@/model/bbox";
import type { Annotation, Point } from "@/model/types";
import { HANDLES, handlePoint, resize, type BoxHandle } from "./resize";

export type Handle = BoxHandle | "start" | "end";

export const HANDLE_SIZE = 8;

/** A box's eight, where they sit. */
export const boxHandles = (box: Box): [BoxHandle, Point][] =>
  HANDLES.map((h) => [h, handlePoint(box, h)]);

export const handlesOf = (a: Annotation): [Handle, Point][] => {
  if (a.kind === "arrow")
    return [
      ["start", { x: a.x1, y: a.y1 }],
      ["end", { x: a.x2, y: a.y2 }],
    ];
  const box = outline(a);
  if (a.kind === "text")
    return [["e", { x: a.x + a.width, y: box.y + box.h / 2 }]];
  return boxHandles(box);
};

/** The handle under `p`, its 8 screen px converted to image px at this zoom. */
const under = <H>(handles: [H, Point][], p: Point, scale: number): H | null => {
  const reach = HANDLE_SIZE / 2 / scale;
  const found = handles.find(
    ([, c]) => Math.abs(p.x - c.x) <= reach && Math.abs(p.y - c.y) <= reach,
  );
  return found ? found[0] : null;
};

export const handleAt = (a: Annotation, p: Point, scale: number) =>
  under(handlesOf(a), p, scale);

/** The fields that change when `handle` is dragged to `p`, and the handle the pointer holds now. */
export const reshape = (
  start: Annotation,
  handle: Handle,
  p: Point,
  keepAspect = false,
): { patch: Partial<Annotation>; handle: Handle } => {
  if (start.kind === "arrow")
    return {
      patch: handle === "start" ? { x1: p.x, y1: p.y } : { x2: p.x, y2: p.y },
      handle,
    };
  if (start.kind === "text")
    return {
      patch: { width: Math.max(start.fontSize, p.x - start.x) },
      handle,
    };
  const { box, handle: held } = resize(
    outline(start),
    handle as BoxHandle,
    p,
    keepAspect,
  );
  return { patch: box, handle: held };
};

export const CURSOR: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  start: "move",
  end: "move",
};

/** A group's handle under `p`: the eight of the box around it (screen 16). */
export const groupHandleAt = (box: Box, p: Point, scale: number) =>
  under(boxHandles(box), p, scale);

/** One member of a group, carried from the group's box `from` into `to`. */
export const scaleInto = (a: Annotation, from: Box, to: Box) => {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  const x = (v: number) => to.x + (v - from.x) * sx;
  const y = (v: number) => to.y + (v - from.y) * sy;
  if (a.kind === "arrow")
    return { x1: x(a.x1), y1: y(a.y1), x2: x(a.x2), y2: y(a.y2) };
  if (a.kind === "text")
    return { x: x(a.x), y: y(a.y), width: Math.max(a.fontSize, a.width * sx) };
  return { x: x(a.x), y: y(a.y), w: a.w * sx, h: a.h * sy };
};
