import { describe, expect, it } from "vitest";
import { createDoc } from "@/model/doc";
import type { RectA } from "@/model/types";
import { hitTest } from "./hit";

const rect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): RectA => ({
  id,
  kind: "rect",
  color: "red",
  strokeWidth: 10,
  opacity: 1,
  x,
  y,
  w,
  h,
});

const doc = createDoc({ w: 4000, h: 3000 }, [
  rect("below", 100, 100, 1000, 600),
  rect("above", 600, 300, 1000, 600),
]);

describe("hitTest", () => {
  it("picks the topmost annotation where two overlap", () => {
    // (600, 700) is on both frames: below's bottom edge and above's left edge.
    expect(hitTest(doc, { x: 600, y: 700 }, 1)).toBe("above");
  });

  it("an unfilled box is hit on its frame, not in its middle", () => {
    expect(hitTest(doc, { x: 1100, y: 400 }, 1)).toBe("below");
    expect(
      hitTest(
        createDoc({ w: 4000, h: 3000 }, [rect("r", 100, 100, 1000, 600)]),
        { x: 600, y: 400 },
        1,
      ),
    ).toBeNull();
  });

  it("the tolerance is screen px: 8 image px off the frame hits at 100%, not at 400%", () => {
    const one = createDoc({ w: 4000, h: 3000 }, [
      rect("r", 100, 100, 1000, 600),
    ]);
    // Half the 10 px stroke plus 6 screen px of tolerance: 11 image px at 100%, 6.5 at 400%.
    expect(hitTest(one, { x: 92, y: 400 }, 1)).toBe("r");
    expect(hitTest(one, { x: 92, y: 400 }, 4)).toBeNull();
  });
});
