import { describe, expect, it } from "vitest";
import { resize, type BoxHandle } from "./resize";

const start = { x: 100, y: 100, w: 200, h: 100 };

describe("resize", () => {
  it.each<
    [
      string,
      BoxHandle,
      { x: number; y: number },
      boolean,
      { x: number; y: number; w: number; h: number },
      BoxHandle,
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
