import { describe, expect, it } from "vitest";
import { arrow, rect } from "@/test/shapes";
import { handleAt, reshape } from "./handles";

describe("handles", () => {
  it("are 8 screen px at any zoom", () => {
    const box = rect("r", { x: 100, y: 100, w: 200, h: 100 });
    // 3 screen px from the corner is on the handle, 6 is not, at 10% and at 400%.
    for (const scale of [0.1, 4]) {
      expect(handleAt(box, { x: 300 + 3 / scale, y: 200 }, scale)).toBe("se");
      expect(handleAt(box, { x: 300 + 6 / scale, y: 200 }, scale)).toBeNull();
    }
  });

  it("an arrow's tip handle moves its tip, the tail staying put", () => {
    const a = arrow("a", { x1: 100, y1: 100, x2: 300, y2: 200 });
    const handle = handleAt(a, { x: 302, y: 201 }, 1)!;
    expect(reshape(a, handle, { x: 400, y: 250 }).patch).toEqual({
      x2: 400,
      y2: 250,
    });
  });
});
