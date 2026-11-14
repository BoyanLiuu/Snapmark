/**
 * The interaction state machine (ARCHITECTURE.md §9). Pure: the stage feeds it pointer events and
 * applies the effects it returns. The document changes once, when a gesture ends.
 */

import { reshape, scaleInto, type Handle } from "@/geom/handles";
import { resize, type BoxHandle } from "@/geom/resize";
import type { Box } from "@/model/bbox";
import { toggleIn } from "@/lib/set";
import { translated, withAnnotation } from "@/model/doc";
import type { Annotation, Doc, Id, Point } from "@/model/types";

export type ToolId =
  "select" | "rect" | "arrow" | "highlight" | "text" | "pixelate";

const DRAW_TOOLS = ["rect", "arrow", "highlight", "pixelate"] as const;

export type DrawTool = (typeof DRAW_TOOLS)[number];

export const isDrawTool = (tool: ToolId): tool is DrawTool =>
  (DRAW_TOOLS as readonly ToolId[]).includes(tool);

/** In screen px, so a click is a click at any zoom. */
const DRAG_THRESHOLD = 3;

export interface Change {
  id: Id;
  patch: Partial<Annotation>;
}

export type Gesture =
  | { kind: "idle" }
  /** Down on an annotation, not yet past the threshold: still a click. */
  | { kind: "pressing"; ids: Id[]; from: Point; fromScreen: Point }
  | { kind: "moving"; ids: Id[]; from: Point; to: Point }
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
      /** What was selected, as it was; with `box`, a group resized as one (screen 16). */
      start: Annotation[];
      box: Box | null;
      grabbed: Handle;
      /** The handle the pointer holds now: the mirror of the grabbed one past a flip. */
      handle: Handle;
      changes: Change[] | null;
      fromScreen: Point;
    }
  /** Dragging a marquee on empty ground (screen 15); `base` is kept, with Shift. */
  | { kind: "marquee"; base: Id[]; from: Point; to: Point; fromScreen: Point };

export interface PointerAt {
  image: Point;
  screen: Point;
  /** Adds to the selection; keeps the aspect while resizing from a corner. */
  shift?: boolean;
}

export type Effect =
  | { kind: "select"; ids: Id[] }
  | { kind: "draw"; tool: DrawTool; from: Point; to: Point }
  | { kind: "move"; ids: Id[]; dx: number; dy: number }
  | { kind: "reshape"; changes: Change[] }
  /** Start a label at this image point (M13). */
  | { kind: "write"; at: Point }
  /** Select what the box touches, added to `base`. */
  | { kind: "marquee"; box: Box; base: Id[] };

export const IDLE: Gesture = { kind: "idle" };

const beyond = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y) > DRAG_THRESHOLD;

/** The box from one corner to the other, whichever way the drag went. */
export const between = (a: Point, b: Point): Box => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x),
  h: Math.abs(b.y - a.y),
});

/**
 * A handle of the selection wins, then an annotation under the pointer, then drawing, or a marquee
 * with the select tool. Shift adds an annotation to the selection or takes it out.
 */
export const press = (
  tool: ToolId,
  hit: Id | null,
  at: PointerAt,
  selection: readonly Id[],
  grab?: { start: Annotation[]; box: Box | null; handle: Handle },
): [Gesture, Effect[]] => {
  if (grab)
    return [
      {
        kind: "reshaping",
        ...grab,
        grabbed: grab.handle,
        changes: null,
        fromScreen: at.screen,
      },
      [],
    ];
  if (hit) {
    let ids: Id[];
    if (at.shift) ids = toggleIn(selection, hit);
    else ids = selection.includes(hit) ? [...selection] : [hit];
    return [
      { kind: "pressing", ids, from: at.image, fromScreen: at.screen },
      [{ kind: "select", ids }],
    ];
  }
  const deselect: Effect = { kind: "select", ids: [] };
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
  const base = at.shift ? [...selection] : [];
  return [
    {
      kind: "marquee",
      base,
      from: at.image,
      to: at.image,
      fromScreen: at.screen,
    },
    [{ kind: "select", ids: base }],
  ];
};

export const move = (g: Gesture, at: PointerAt): Gesture => {
  if (g.kind === "pressing")
    return beyond(at.screen, g.fromScreen)
      ? { kind: "moving", ids: g.ids, from: g.from, to: at.image }
      : g;
  if (g.kind === "moving" || g.kind === "marquee")
    return { ...g, to: at.image };
  if (g.kind === "drawing")
    return {
      ...g,
      to: at.image,
      dragged: g.dragged || beyond(at.screen, g.fromScreen),
    };
  if (g.kind === "reshaping") {
    if (!g.changes && !beyond(at.screen, g.fromScreen)) return g;
    if (g.box) {
      const { box, handle } = resize(
        g.box,
        g.grabbed as BoxHandle,
        at.image,
        at.shift,
      );
      const changes = g.start.map((a) => ({
        id: a.id,
        patch: scaleInto(a, g.box!, box),
      }));
      return { ...g, changes, handle };
    }
    const [one] = g.start;
    const { patch, handle } = reshape(one, g.grabbed, at.image, at.shift);
    return { ...g, changes: [{ id: one.id, patch }], handle };
  }
  return g;
};

export const release = (g: Gesture, at: PointerAt): Effect[] => {
  const end = move(g, at);
  if (end.kind === "moving")
    return [
      {
        kind: "move",
        ids: end.ids,
        dx: end.to.x - end.from.x,
        dy: end.to.y - end.from.y,
      },
    ];
  if (end.kind === "drawing" && end.dragged)
    return [{ kind: "draw", tool: end.tool, from: end.from, to: end.to }];
  if (end.kind === "reshaping" && end.changes)
    return [{ kind: "reshape", changes: end.changes }];
  if (end.kind === "marquee" && beyond(at.screen, end.fromScreen))
    return [
      { kind: "marquee", box: between(end.from, end.to), base: end.base },
    ];
  return [];
};

/** The document as the gesture would leave it, for drawing only; null when there is nothing to show. */
export const preview = (
  g: Gesture,
  doc: Doc,
  draft: (tool: DrawTool, from: Point, to: Point) => Annotation,
): Doc | null => {
  if (g.kind === "moving") {
    const dx = g.to.x - g.from.x;
    const dy = g.to.y - g.from.y;
    return g.ids.reduce((d, id) => {
      const a = d.byId.get(id);
      return a ? withAnnotation(d, translated(a, dx, dy)) : d;
    }, doc);
  }
  if (g.kind === "drawing" && g.dragged)
    return withAnnotation(doc, draft(g.tool, g.from, g.to));
  if (g.kind === "reshaping" && g.changes)
    return g.changes.reduce((d, { id, patch }) => {
      const a = d.byId.get(id);
      return a ? withAnnotation(d, { ...a, ...patch } as Annotation) : d;
    }, doc);
  return null;
};
