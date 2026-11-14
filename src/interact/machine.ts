/**
 * The interaction state machine (ARCHITECTURE.md §9). Pure: the stage feeds it pointer events and
 * applies the effects it returns. The document changes once, when a gesture ends.
 */

import { reshape, type Handle } from "@/geom/handles";
import { translated, withAnnotation } from "@/model/doc";
import type { Annotation, Doc, Id, Point } from "@/model/types";

export type ToolId =
  "select" | "rect" | "arrow" | "highlight" | "text" | "pixelate";

const DRAW_TOOLS = ["rect", "arrow", "highlight"] as const;

export type DrawTool = (typeof DRAW_TOOLS)[number];

export const isDrawTool = (tool: ToolId): tool is DrawTool =>
  (DRAW_TOOLS as readonly ToolId[]).includes(tool);

/** In screen px, so a click is a click at any zoom. */
const DRAG_THRESHOLD = 3;

export type Gesture =
  | { kind: "idle" }
  /** Down on an annotation, not yet past the threshold: still a click. */
  | { kind: "pressing"; id: Id; from: Point; fromScreen: Point }
  | { kind: "moving"; id: Id; from: Point; to: Point }
  | {
      kind: "drawing";
      tool: DrawTool;
      from: Point;
      to: Point;
      fromScreen: Point;
      dragged: boolean;
    }
  | {
      kind: "reshaping";
      start: Annotation;
      grabbed: Handle;
      /** The handle the pointer holds now: the mirror of the grabbed one past a flip. */
      handle: Handle;
      patch: Partial<Annotation> | null;
      fromScreen: Point;
    };

export interface PointerAt {
  image: Point;
  screen: Point;
  /** Keep the aspect while resizing from a corner. */
  shift?: boolean;
}

export type Effect =
  | { kind: "select"; id: Id | null }
  | { kind: "draw"; tool: DrawTool; from: Point; to: Point }
  | { kind: "move"; id: Id; dx: number; dy: number }
  | { kind: "reshape"; id: Id; patch: Partial<Annotation> }
  /** Start a label at this image point (M13). */
  | { kind: "write"; at: Point };

export const IDLE: Gesture = { kind: "idle" };

const beyond = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y) > DRAG_THRESHOLD;

/** A handle of the selection wins, then an annotation under the pointer, then drawing. */
export const press = (
  tool: ToolId,
  hit: Id | null,
  at: PointerAt,
  grab?: { annotation: Annotation; handle: Handle },
): [Gesture, Effect[]] => {
  if (grab)
    return [
      {
        kind: "reshaping",
        start: grab.annotation,
        grabbed: grab.handle,
        handle: grab.handle,
        patch: null,
        fromScreen: at.screen,
      },
      [],
    ];
  if (hit)
    return [
      { kind: "pressing", id: hit, from: at.image, fromScreen: at.screen },
      [{ kind: "select", id: hit }],
    ];
  const deselect: Effect = { kind: "select", id: null };
  if (isDrawTool(tool))
    return [
      {
        kind: "drawing",
        tool,
        from: at.image,
        to: at.image,
        fromScreen: at.screen,
        dragged: false,
      },
      [deselect],
    ];
  if (tool === "text")
    return [IDLE, [deselect, { kind: "write", at: at.image }]];
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
  if (g.kind === "reshaping") {
    if (!g.patch && !beyond(at.screen, g.fromScreen)) return g;
    const { patch, handle } = reshape(g.start, g.grabbed, at.image, at.shift);
    return { ...g, patch, handle };
  }
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
    return [{ kind: "draw", tool: end.tool, from: end.from, to: end.to }];
  if (end.kind === "reshaping" && end.patch)
    return [{ kind: "reshape", id: end.start.id, patch: end.patch }];
  return [];
};

/** The document as the gesture would leave it, for drawing only; null when there is nothing to show. */
export const preview = (
  g: Gesture,
  doc: Doc,
  draft: (tool: DrawTool, from: Point, to: Point) => Annotation,
): Doc | null => {
  if (g.kind === "moving") {
    const a = doc.byId.get(g.id);
    return a
      ? withAnnotation(doc, translated(a, g.to.x - g.from.x, g.to.y - g.from.y))
      : null;
  }
  if (g.kind === "drawing" && g.dragged)
    return withAnnotation(doc, draft(g.tool, g.from, g.to));
  if (g.kind === "reshaping" && g.patch)
    return withAnnotation(doc, { ...g.start, ...g.patch } as Annotation);
  return null;
};
