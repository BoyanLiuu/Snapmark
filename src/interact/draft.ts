import type { SwatchId } from "@/model/palette";
import type { Annotation, Point } from "@/model/types";
import type { DrawTool } from "./machine";

export interface Look {
  color: SwatchId;
  strokeWidth: number;
  opacity: number;
}

/** What a drag from `from` to `to` draws with this tool: a box whichever way it went, an arrow tail first. */
export const drawn = (
  tool: DrawTool,
  from: Point,
  to: Point,
  look: Look,
  id: string,
): Annotation =>
  tool === "arrow"
    ? { id, kind: "arrow", ...look, x1: from.x, y1: from.y, x2: to.x, y2: to.y }
    : {
        id,
        kind: "rect",
        ...look,
        x: Math.min(from.x, to.x),
        y: Math.min(from.y, to.y),
        w: Math.abs(to.x - from.x),
        h: Math.abs(to.y - from.y),
      };
