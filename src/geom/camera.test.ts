import { describe, expect, it } from "vitest";
import { fit } from "./camera";

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
