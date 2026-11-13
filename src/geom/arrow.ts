/**
 * Arrowheads that stay correct at any length (ARCHITECTURE.md §7): sized along the shaft and
 * clamped against the stroke, with a constant spread, and the shaft shortened to meet the head so
 * its end never pokes out. Short arrows are settled in M7, with tests at 3, 40 and 2000 px.
 */

import type { ArrowA, Point } from "@/model/types";

const SPREAD = Math.PI / 7;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export interface ArrowGeometry {
  /** Where the shaft stops, inside the head. */
  shaftEnd: Point;
  /** The head, tip first. */
  head: [Point, Point, Point];
}

export const arrowGeometry = ({
  x1,
  y1,
  x2,
  y2,
  strokeWidth: sw,
}: ArrowA): ArrowGeometry => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = Math.hypot(x2 - x1, y2 - y1);
  // Never longer than the arrow itself, whatever the stroke.
  const head = Math.min(clamp(length * 0.28, 4 * sw, 10 * sw), length);
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
