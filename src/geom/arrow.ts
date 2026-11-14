/**
 * Arrowheads that stay correct at any length (ARCHITECTURE.md §7): sized along the shaft, at a
 * constant spread, with the shaft shortened so its end never pokes out of the head.
 */

import type { ArrowA, Point } from "@/model/types";

const SPREAD = Math.PI / 7;

export const arrowLength = (a: ArrowA) => Math.hypot(a.x2 - a.x1, a.y2 - a.y1);

/** Too short to be an arrow: discarded rather than stored as one nobody can select. */
export const degenerate = (a: ArrowA) => arrowLength(a) < 2 * a.strokeWidth;

/**
 * 28% of the shaft, kept between 4 and 10 strokes. Those bounds meet only from 14 strokes long;
 * below that the head stops at half the arrow, so a short one is never mostly head.
 */
export const headLength = (length: number, strokeWidth: number) =>
  Math.min(
    Math.max(length * 0.28, 4 * strokeWidth),
    10 * strokeWidth,
    length / 2,
  );

export interface ArrowGeometry {
  shaftEnd: Point;
  /** Tip first. */
  head: [Point, Point, Point];
}

export const arrowGeometry = (a: ArrowA): ArrowGeometry => {
  const { x1, y1, x2, y2 } = a;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = headLength(arrowLength(a), a.strokeWidth);
  const corner = (side: number) => ({
    x: x2 - head * Math.cos(angle + side * SPREAD),
    y: y2 - head * Math.sin(angle + side * SPREAD),
  });
  return {
    shaftEnd: {
      x: x2 - head * 0.8 * Math.cos(angle),
      y: y2 - head * 0.8 * Math.sin(angle),
    },
    head: [{ x: x2, y: y2 }, corner(-1), corner(1)],
  };
};
