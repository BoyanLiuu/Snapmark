// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { Point } from "@/model/types";
import { deviceMatrix } from "@/render/view";
import { toImage, toScreen } from "./matrix";

const near = (actual: Point, expected: Point, tolerance = 1e-9) => {
  expect(
    Math.abs(actual.x - expected.x),
    `x ${actual.x} vs ${expected.x}`,
  ).toBeLessThan(tolerance);
  expect(
    Math.abs(actual.y - expected.y),
    `y ${actual.y} vs ${expected.y}`,
  ).toBeLessThan(tolerance);
};

describe("the coordinate chain (M2's gate)", () => {
  it("maps image px to screen px as scale, then pan", () => {
    // A round trip alone would also pass with the order reversed, so pin the meaning.
    const camera = { scale: 0.25, tx: 40, ty: 12 };
    expect(toScreen(camera, { x: 0, y: 0 })).toEqual({ x: 40, y: 12 });
    expect(toScreen(camera, { x: 100, y: 50 })).toEqual({ x: 65, y: 24.5 });
  });

  it("paints at M × dpr and reads the pointer back to the same image pixel: 5 scales × 3 ratios", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 2964, y: 939 },
      { x: 3839.75, y: 2406.5 },
      { x: -120.5, y: 4000.25 },
    ];
    for (const scale of [0.1, 0.26, 1, 4, 8]) {
      for (const dpr of [1, 2, 3]) {
        const camera = { scale, tx: 37.25, ty: -18.5 };
        const device = deviceMatrix(camera, dpr);
        for (const p of points) {
          const painted = device.transformPoint(p);
          const screen = toScreen(camera, p);
          // The device matrix is M with only the pixel ratio in front...
          near({ x: painted.x / dpr, y: painted.y / dpr }, screen);
          // ...and a pointer, which arrives in CSS px, reads back the pixel that was painted.
          near(toImage(camera, screen), p);
        }
      }
    }
  });
});
