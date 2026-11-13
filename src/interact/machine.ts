/**
 * The interaction state machine (ARCHITECTURE.md §9). Pure: the stage feeds it pointer events and
 * applies the effects it returns. The document changes once, when a gesture ends.
 */

import type { Box } from "@/model/bbox";
import { translated, withAnnotation } from "@/model/doc";
import type { Annotation, Doc, Id, Point } from "@/model/types";

export type ToolId =
  "select" | "rect" | "arrow" | "highlight" | "text" | "pixelate";

/** In screen px, so a click is a click at any zoom. */
const DRAG_THRESHOLD = 3;

export type Gesture =
  | { kind: "idle" }
  /** Down on an annotation, not yet moved past the threshold: still a click. */
  | { kind: "pressing"; id: Id; from: Point; fromScreen: Point }
  | { kind: "moving"; id: Id; from: Point; to: Point }
  | {
      kind: "drawing";
      from: Point;
      to: Point;
      fromScreen: Point;
      dragged: boolean;
    };

export interface PointerAt {
  image: Point;
  screen: Point;
}

export type Effect =
  | { kind: "select"; id: Id | null }
  | { kind: "draw"; box: Box }
  | { kind: "move"; id: Id; dx: number; dy: number };

export const IDLE: Gesture = { kind: "idle" };

const beyond = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y) > DRAG_THRESHOLD;

const boxBetween = (a: Point, b: Point): Box => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x),
  h: Math.abs(b.y - a.y),
});

/** An annotation under the pointer wins over drawing a new one. */
export const press = (
  tool: ToolId,
  hit: Id | null,
  at: PointerAt,
): [Gesture, Effect[]] => {
  if (hit)
    return [
      { kind: "pressing", id: hit, from: at.image, fromScreen: at.screen },
      [{ kind: "select", id: hit }],
    ];
  const deselect: Effect = { kind: "select", id: null };
  if (tool === "rect")
    return [
      {
        kind: "drawing",
        from: at.image,
        to: at.image,
        fromScreen: at.screen,
        dragged: false,
      },
      [deselect],
    ];
  return [IDLE, [deselect]];
};

export const move = (g: Gesture, at: PointerAt): Gesture => {
  if (g.kind === "pressing")
    return beyond(at.screen, g.fromScreen)
      ? { kind: "moving", id: g.id, from: g.from, to: at.image }
      : g;
  if (g.kind === "moving") return { ...g, to: at.image };
  if (g.kind === "drawing")
    return {
      ...g,
      to: at.image,
      dragged: g.dragged || beyond(at.screen, g.fromScreen),
    };
  return g;
};

export const release = (g: Gesture, at: PointerAt): Effect[] => {
  const end = move(g, at);
  if (end.kind === "moving")
    return [
      {
        kind: "move",
        id: end.id,
        dx: end.to.x - end.from.x,
        dy: end.to.y - end.from.y,
      },
    ];
  if (end.kind === "drawing" && end.dragged)
    return [{ kind: "draw", box: boxBetween(end.from, end.to) }];
  return [];
};

/** The document as the gesture would leave it, for drawing only; null when there is nothing to show. */
export const preview = (
  g: Gesture,
  doc: Doc,
  draft: (box: Box) => Annotation,
): Doc | null => {
  if (g.kind === "moving") {
    const a = doc.byId.get(g.id);
    return a
      ? withAnnotation(doc, translated(a, g.to.x - g.from.x, g.to.y - g.from.y))
      : null;
  }
  if (g.kind === "drawing" && g.dragged)
    return withAnnotation(doc, draft(boxBetween(g.from, g.to)));
  return null;
};
