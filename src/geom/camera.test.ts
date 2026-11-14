// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { fit, MAX_SCALE, zoomAt } from "./camera";
import { toImage } from "./matrix";

describe("fit", () => {
  it.each([
    ["a wide image in a stage", { w: 3840, h: 2407 }, { w: 1120, h: 751 }],
    ["a tall image in a stage", { w: 800, h: 2400 }, { w: 1120, h: 751 }],
  ])(
    "shows %s whole and centred, filling 95% of the tighter axis",
    (_, nat, view) => {
      const { scale, tx, ty } = fit(nat, view);
      const w = nat.w * scale;
      const h = nat.h * scale;
      expect(Math.max(w / view.w, h / view.h)).toBeCloseTo(0.95, 12);
      expect(tx).toBeCloseTo(view.w - (tx + w), 9);
      expect(ty).toBeCloseTo(view.h - (ty + h), 9);
    },
  );
});

describe("zoomAt", () => {
  const cam = { scale: 0.25, tx: 40, ty: -12 };
  const cursor = { x: 611, y: 207 };

  it.each([
    ["zooming in", 1.25],
    ["zooming out", 0.5],
    ["clamped at 800%", 1000],
  ])("keeps the image point under the cursor under it, %s", (_, k) => {
    const before = toImage(cam, cursor);
    const zoomed = zoomAt(cam, cursor, k);
    const after = toImage(zoomed, cursor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(zoomed.scale).toBeLessThanOrEqual(MAX_SCALE);
  });
});
