/**
 * Boxes in image px. `outline` is the shape's own geometry, where the selection and its handles sit;
 * `bbox` adds what is painted around it (half the stroke, the arrowhead's spread, the text plate),
 * for hit testing and, from M17, the out-of-bounds check.
 */

import { arrowGeometry } from "@/geom/arrow";
import { layoutText, PLATE_PAD } from "@/render/text-layout";
import type { Annotation, Point } from "./types";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const around = (points: Point[], inflate: number): Box => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - inflate;
  const y = Math.min(...ys) - inflate;
  return {
    x,
    y,
    w: Math.max(...xs) + inflate - x,
    h: Math.max(...ys) + inflate - y,
  };
};

export const outline = (a: Annotation): Box => {
  if (a.kind === "arrow")
    return around(
      [
        { x: a.x1, y: a.y1 },
        { x: a.x2, y: a.y2 },
      ],
      0,
    );
  if (a.kind === "text") {
    const { lines, widest, lineHeight } = layoutText(a);
    const pad = a.plate ? a.fontSize * PLATE_PAD : 0;
    return {
      x: a.x - pad,
      y: a.y - pad,
      w: widest + 2 * pad,
      h: lines.length * lineHeight + 2 * pad,
    };
  }
  return { x: a.x, y: a.y, w: a.w, h: a.h };
};

export const bbox = (a: Annotation): Box => {
  if (a.kind === "arrow") {
    const { head } = arrowGeometry(a);
    return around([{ x: a.x1, y: a.y1 }, ...head], a.strokeWidth / 2);
  }
  const box = outline(a);
  if (a.kind !== "rect") return box;
  const half = a.strokeWidth / 2;
  return {
    x: box.x - half,
    y: box.y - half,
    w: box.w + 2 * half,
    h: box.h + 2 * half,
  };
};

/** The smallest box around all of these. */
export const union = (boxes: readonly Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
};
