import { describe, expect, it } from "vitest";
import { handleAt, resize, type Handle } from "./resize";

const start = { x: 100, y: 100, w: 200, h: 100 };

describe("resize", () => {
  it.each<
    [
      string,
      Handle,
      { x: number; y: number },
      boolean,
      { x: number; y: number; w: number; h: number },
      Handle,
    ]
  >([
    [
      "an edge moves one axis only",
      "e",
      { x: 350, y: 999 },
      false,
      { x: 100, y: 100, w: 250, h: 100 },
      "e",
    ],
    [
      "past the opposite edge, one axis flips",
      "w",
      { x: 400, y: 0 },
      false,
      { x: 300, y: 100, w: 100, h: 100 },
      "e",
    ],
    [
      "past the opposite corner, both flip",
      "nw",
      { x: 350, y: 260 },
      false,
      { x: 300, y: 200, w: 50, h: 60 },
      "se",
    ],
    [
      "shift keeps the aspect, the larger change winning",
      "se",
      { x: 500, y: 150 },
      true,
      { x: 100, y: 100, w: 400, h: 200 },
      "se",
    ],
    [
      "shift keeps the aspect through a flip",
      "se",
      { x: 0, y: 90 },
      true,
      { x: 0, y: 50, w: 100, h: 50 },
      "nw",
    ],
  ])("%s", (_, handle, p, keepAspect, box, live) => {
    expect(resize(start, handle, p, keepAspect)).toEqual({ box, handle: live });
  });
});

describe("handleAt", () => {
  it("handles are 8 screen px at any zoom", () => {
    // 3 screen px from the corner is on the handle, 6 is not, at 10% and at 400%.
    for (const scale of [0.1, 4]) {
      expect(handleAt(start, { x: 300 + 3 / scale, y: 200 }, scale)).toBe("se");
      expect(handleAt(start, { x: 300 + 6 / scale, y: 200 }, scale)).toBeNull();
    }
  });
});
