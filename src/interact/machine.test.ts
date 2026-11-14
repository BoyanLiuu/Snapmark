import { describe, expect, it } from "vitest";
import { rect } from "@/test/shapes";
import { move, press, release } from "./machine";

/** An image point and the screen point it shows at, here at 25% with no pan. */
const at = (x: number, y: number, scale = 0.25) => ({
  image: { x, y },
  screen: { x: x * scale, y: y * scale },
});

describe("the interaction machine", () => {
  it("a press selects; under 3 screen px it stays a click, even 8 image px at 25%", () => {
    const [down, effects] = press("select", "a", at(400, 400));
    expect(effects).toEqual([{ kind: "select", id: "a" }]);
    expect(move(down, at(408, 400)).kind).toBe("pressing");
    expect(release(down, at(408, 400))).toEqual([]);
    expect(move(down, at(416, 400)).kind).toBe("moving");
  });

  it("a drag past the threshold moves the annotation, once, by image px", () => {
    const [down] = press("select", "a", at(400, 400));
    const dragging = move(move(down, at(440, 420)), at(480, 440));
    expect(release(dragging, at(500, 460))).toEqual([
      { kind: "move", id: "a", dx: 100, dy: 60 },
    ]);
  });

  it("with the rectangle, a click on empty ground draws nothing (no 0 × 0 box)", () => {
    const [down, effects] = press("rect", null, at(400, 400));
    expect(effects).toEqual([{ kind: "select", id: null }]);
    expect(release(down, at(404, 400))).toEqual([]);
  });

  it("a drag with the arrow draws from where it started to where it ended", () => {
    const [down] = press("arrow", null, at(800, 600));
    expect(release(move(down, at(400, 400)), at(400, 400))).toEqual([
      {
        kind: "draw",
        tool: "arrow",
        from: { x: 800, y: 600 },
        to: { x: 400, y: 400 },
      },
    ]);
  });

  it("an annotation under the pointer wins over drawing a new box", () => {
    expect(press("rect", "a", at(400, 400))[0].kind).toBe("pressing");
  });

  it("dragging a handle reshapes once, on release; a click on a handle changes nothing", () => {
    const box = rect("a", { x: 400, y: 400, w: 400, h: 200 });
    const [down, effects] = press("select", "a", at(800, 600), {
      annotation: box,
      handle: "se",
    });
    expect(effects).toEqual([]);
    expect(release(down, at(804, 600))).toEqual([]);
    expect(release(move(down, at(1000, 700)), at(1000, 700))).toEqual([
      { kind: "reshape", id: "a", patch: { x: 400, y: 400, w: 600, h: 300 } },
    ]);
  });
});
