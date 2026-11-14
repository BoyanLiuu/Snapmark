import { describe, expect, it } from "vitest";
import { LOOK } from "@/test/shapes";
import { drawn } from "./draft";

describe("drawn", () => {
  it("a box dragged up and to the left still has a positive size", () => {
    expect(
      drawn("rect", { x: 800, y: 600 }, { x: 400, y: 400 }, LOOK, "b"),
    ).toMatchObject({
      x: 400,
      y: 400,
      w: 400,
      h: 200,
    });
  });
});
