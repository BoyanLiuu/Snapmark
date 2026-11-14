/**
 * What is under the pointer: a reverse scan of the paint order, topmost first (ARCHITECTURE.md §7).
 * The pointer is 6 screen px wide at any zoom, so the tolerance is converted at the point of use.
 */

import { bbox, outline, type Box } from "@/model/bbox";
import { annotations } from "@/model/doc";
import type { Annotation, Doc, Id, Point } from "@/model/types";
import { arrowGeometry } from "./arrow";

const HIT_TOLERANCE = 6;

const within = (p: Point, b: Box, pad: number) =>
  p.x >= b.x - pad &&
  p.x <= b.x + b.w + pad &&
  p.y >= b.y - pad &&
  p.y <= b.y + b.h + pad;

const toSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const inTriangle = (p: Point, [a, b, c]: [Point, Point, Point]) => {
  const side = (u: Point, v: Point) =>
    (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
  const [s1, s2, s3] = [side(a, b), side(b, c), side(c, a)];
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
};

const hits = (a: Annotation, p: Point, tol: number) => {
  if (a.kind === "rect") {
    // Unfilled, so only the frame: within the tolerance plus half the stroke of an edge.
    const reach = tol + a.strokeWidth / 2;
    const o = outline(a);
    if (!within(p, o, reach)) return false;
    const hollow = {
      x: o.x + reach,
      y: o.y + reach,
      w: o.w - 2 * reach,
      h: o.h - 2 * reach,
    };
    return hollow.w <= 0 || hollow.h <= 0 || !within(p, hollow, 0);
  }
  if (a.kind === "arrow") {
    const { head } = arrowGeometry(a);
    return (
      toSegment(p, { x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }) <=
        tol + a.strokeWidth / 2 || inTriangle(p, head)
    );
  }
  // Highlights, pixelate regions and text are solid: anywhere inside counts.
  return within(p, bbox(a), tol);
};

/** The topmost annotation at image point `p`, at this zoom (screen px per image px). */
export const hitTest = (doc: Doc, p: Point, scale: number): Id | null => {
  const tol = HIT_TOLERANCE / scale;
  const all = annotations(doc);
  for (let i = all.length - 1; i >= 0; i -= 1)
    if (hits(all[i], p, tol)) return all[i].id;
  return null;
};

/** The annotations a marquee touches, by what they paint, in paint order (screen 15). */
export const touching = (doc: Doc, box: Box): Id[] =>
  annotations(doc)
    .filter((a) => {
      const b = bbox(a);
      return (
        b.x <= box.x + box.w &&
        b.x + b.w >= box.x &&
        b.y <= box.y + box.h &&
        b.y + b.h >= box.y
      );
    })
    .map((a) => a.id);
