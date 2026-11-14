import { describe, expect, it } from "vitest";
import { LOOK } from "@/test/shapes";
import { drawn } from "./draft";

describe("drawn", () => {
  it("a box dragged up and to the left still has a positive size", () => {
    expect(
      drawn("rect", { x: 800, y: 600 }, { x: 400, y: 400 }, LOOK, "b", 3840),
    ).toMatchObject({
      x: 400,
      y: 400,
      w: 400,
      h: 200,
    });
  });

  it("a highlight drawn in the default red is a yellow marker", () => {
    expect(
      drawn("highlight", { x: 0, y: 0 }, { x: 10, y: 4 }, LOOK, "h", 3840),
    ).toMatchObject({ kind: "highlight", color: "yellow", w: 10, h: 4 });
  });
});
