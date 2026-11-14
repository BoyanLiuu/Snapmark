import { describe, expect, it } from "vitest";
import { exportSize } from "./limits";

describe("the export's size", () => {
  it("is the image's own within the budget, and scaled by √(budget ÷ area) past it", () => {
    const desktop = { budgetMP: 64, maxSide: 16_384 };
    expect(exportSize({ w: 3840, h: 2407 }, desktop)).toMatchObject({
      w: 3840,
      h: 2407,
      scale: 1,
    });
    expect(exportSize({ w: 12000, h: 6000 }, desktop)).toMatchObject({
      w: 11313,
      h: 5656,
    });
  });

  it("keeps to iOS Safari's caps on an iPhone: 16 MP and 4,096 px a side", () => {
    const ios = { budgetMP: 16, maxSide: 4_096 };
    const { w, h } = exportSize({ w: 5000, h: 4000 }, ios);
    expect(Math.max(w, h)).toBeLessThanOrEqual(4096);
    expect(w * h).toBeLessThanOrEqual(16e6);
  });
});
