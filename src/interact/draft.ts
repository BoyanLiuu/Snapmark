import type { SwatchId } from "@/model/palette";
import type { Annotation, Point, TextA } from "@/model/types";
import type { DrawTool } from "./machine";

export interface Look {
  color: SwatchId;
  strokeWidth: number;
  opacity: number;
}

/**
 * What a drag from `from` to `to` draws with this tool: a box whichever way it went, an arrow tail
 * first. A highlight is a marker, so red, the default, becomes yellow (as the design file does).
 */
export const drawn = (
  tool: DrawTool,
  from: Point,
  to: Point,
  look: Look,
  id: string,
): Annotation => {
  if (tool === "arrow")
    return {
      id,
      kind: "arrow",
      ...look,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    };
  const box = {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    w: Math.abs(to.x - from.x),
    h: Math.abs(to.y - from.y),
  };
  if (tool === "highlight")
    return {
      id,
      kind: "highlight",
      ...look,
      color: look.color === "red" ? "yellow" : look.color,
      ...box,
    };
  return { id, kind: "rect", ...look, ...box };
};

/** ARCHITECTURE.md §3: a stroke that reads the same on any image, in image px. */
export const defaultStroke = (naturalWidth: number) =>
  Math.max(2, Math.round(naturalWidth / 400));

/**
 * A new, empty label at `at`, as the design file starts one: white on a plate, type five times the
 * image's default stroke, wrapping at 22% of the image's width.
 */
export const labelAt = (
  at: Point,
  naturalWidth: number,
  look: Look,
  id: string,
): TextA => ({
  id,
  kind: "text",
  ...look,
  color: "white",
  x: at.x,
  y: at.y,
  width: Math.round(naturalWidth * 0.22),
  text: "",
  fontSize: defaultStroke(naturalWidth) * 5,
  plate: true,
});
