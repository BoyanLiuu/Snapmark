import { describe, expect, it } from "vitest";
import { arrow } from "@/test/shapes";
import { arrowGeometry, headLength } from "./arrow";

/** 400 px from (100, 100) at `angle`. */
const at = (angle: number) =>
  arrow("a", {
    x1: 100,
    y1: 100,
    x2: 100 + 400 * Math.cos(angle),
    y2: 100 + 400 * Math.sin(angle),
  });

describe("arrowheads", () => {
  it.each([3, 40, 2000])(
    "at length %i: finite, and within its bounds",
    (length) => {
      const head = headLength(length, 2);
      expect(Number.isFinite(head)).toBe(true);
      expect(head).toBeLessThanOrEqual(length / 2);
      // Long enough for both bounds (14 strokes): never over 28% of the shaft, never under 4 strokes.
      if (length >= 28) {
        expect(head).toBeLessThanOrEqual(length * 0.28);
        expect(head).toBeGreaterThanOrEqual(8);
      }
    },
  );

  it("a thick short arrow is not mostly head", () => {
    expect(headLength(30, 11)).toBe(15);
  });

  it("the head is symmetric about the shaft at any angle: not skewed on diagonals", () => {
    for (const angle of [0, Math.PI / 4, 2.1, -1, Math.PI]) {
      const [tip, left, right] = arrowGeometry(at(angle)).head;
      const u = { x: Math.cos(angle), y: Math.sin(angle) };
      const along = (p: { x: number; y: number }) =>
        (p.x - tip.x) * u.x + (p.y - tip.y) * u.y;
      const across = (p: { x: number; y: number }) =>
        (p.x - tip.x) * u.y - (p.y - tip.y) * u.x;
      expect(along(left)).toBeCloseTo(along(right), 9);
      expect(across(left)).toBeCloseTo(-across(right), 9);
    }
  });
});
