/**
 * Handles, per kind: eight on a box, one at each end of an arrow, none on text until M13. Drawn and
 * hit at 8 screen px at any zoom, converted to image px only where they are used.
 */

import { outline } from "@/model/bbox";
import type { Annotation, Point } from "@/model/types";
import { HANDLES, handlePoint, resize, type BoxHandle } from "./resize";

export type Handle = BoxHandle | "start" | "end";

export const HANDLE_SIZE = 8;

export const handlesOf = (a: Annotation): [Handle, Point][] => {
  if (a.kind === "arrow")
    return [
      ["start", { x: a.x1, y: a.y1 }],
      ["end", { x: a.x2, y: a.y2 }],
    ];
  if (a.kind === "text") return [];
  const box = outline(a);
  return HANDLES.map((h) => [h, handlePoint(box, h)]);
};

export const handleAt = (
  a: Annotation,
  p: Point,
  scale: number,
): Handle | null => {
  const reach = HANDLE_SIZE / 2 / scale;
  const found = handlesOf(a).find(
    ([, c]) => Math.abs(p.x - c.x) <= reach && Math.abs(p.y - c.y) <= reach,
  );
  return found ? found[0] : null;
};

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
