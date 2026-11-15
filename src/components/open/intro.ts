/**
 * The open screen's figure annotating itself once (components/open/hero.tsx): a pointer comes in,
 * drags out the box around the boathouse, then types the label above it, letter by letter, and the
 * sample's other marks follow. It runs once a visit; with reduced motion the figure is simply
 * drawn as it ends.
 */

import { beat, linear } from "@/lib/animate";
import { annotations, withAnnotation, withoutIds } from "@/model/doc";
import { SAMPLE_DOC, SAMPLE_IDS } from "@/model/sample";
import { layoutText } from "@/render/text-layout";
import type { Annotation, Doc, Id, Point, RectA, TextA } from "@/model/types";

/**
 * Milliseconds from the first frame, at the figure's own pace. The gaps are deliberate: a hand
 * arrives, settles, then presses; it reads as working rather than as a shape appearing.
 */
const REACH = [0, 260] as const;
const DRAG = [400, 1000] as const;
const MOVE = [1100, 1340] as const;
const TYPE = [1440, 2300] as const;
const REST = [2400, 2700] as const;

/** The whole sequence: the last beat to end, so it can't drift from the beats above. */
export const INTRO_MS = Math.max(
  ...[REACH, DRAG, MOVE, TYPE, REST].map((b) => b[1]),
);

const all = annotations(SAMPLE_DOC);
const sampled = <T extends Annotation>(id: Id) => {
  const found = all.find((a) => a.id === id);
  if (!found) throw new Error(`The sample has no annotation ${id}`);
  return found as T;
};

/** The box around the boathouse, big enough to watch being drawn, and the label above it. */
const drawnBox = sampled<RectA>(SAMPLE_IDS.boathouseBox);
const typedLabel = sampled<TextA>(SAMPLE_IDS.boathouseLabel);
/** Everything else waits until the pointer has finished working. */
const rest = all
  .filter((a) => a.id !== drawnBox.id && a.id !== typedLabel.id)
  .map((a) => a.id);

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const between = (from: Point, to: Point, t: number): Point => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
});

/** Where the box starts: the corner the drag pulls from. */
const START = { x: drawnBox.x, y: drawnBox.y };
const END = { x: drawnBox.x + drawnBox.w, y: drawnBox.y + drawnBox.h };
/** Off the bottom-right of the picture, so the pointer arrives from outside it. */
const OFFSTAGE = { x: END.x + 1400, y: END.y + 900 };
/** The label's first line, where the typing begins. */
const CARET_HOME = { x: typedLabel.x, y: typedLabel.y };

/** The pointer: where it is, whether it is pressed, and how solid it is drawn. */
export interface Pointer {
  at: Point;
  pressed: boolean;
  alpha: number;
}

export const pointer = (elapsed: number): Pointer | null => {
  if (elapsed >= REST[1]) return null;
  const reach = beat(elapsed, REACH);
  const drag = beat(elapsed, DRAG);
  const move = beat(elapsed, MOVE);
  // It fades as the last marks arrive, its work done.
  const alpha = 1 - beat(elapsed, [REST[0], REST[0] + 300], linear);
  if (elapsed < DRAG[0])
    return { at: between(OFFSTAGE, START, reach), pressed: false, alpha };
  if (elapsed < MOVE[0])
    return { at: between(START, END, drag), pressed: true, alpha };
  return { at: between(END, CARET_HOME, move), pressed: false, alpha };
};

/** How much of the label has been typed. */
const typed = (elapsed: number) => {
  const t = beat(elapsed, TYPE, linear);
  return typedLabel.text.slice(0, Math.round(typedLabel.text.length * t));
};

/** The caret, while the label is being typed: the end of its last line, and the line's height. */
export const caret = (
  elapsed: number,
): { at: Point; height: number } | null => {
  if (elapsed < TYPE[0] || elapsed > TYPE[1]) return null;
  const text = typed(elapsed);
  const { lines, lineHeight } = layoutText({ ...typedLabel, text });
  const last = lines.at(-1) ?? "";
  // One line on its own measures that line, with no width to wrap against.
  const { widest } = layoutText({ ...typedLabel, text: last, width: Infinity });
  return {
    at: {
      x: typedLabel.x + widest,
      y: typedLabel.y + Math.max(0, lines.length - 1) * lineHeight,
    },
    height: lineHeight,
  };
};

/** The sample as far as it has been annotated: the box, the label as typed, then the rest. */
export const introDoc = (elapsed: number): Doc => {
  const drag = beat(elapsed, DRAG);
  const shown = Math.floor(beat(elapsed, REST) * rest.length);
  const hidden = new Set<Id>(rest.slice(shown));
  if (drag === 0) hidden.add(drawnBox.id);
  const text = typed(elapsed);
  if (!text) hidden.add(typedLabel.id);
  let doc = withoutIds(SAMPLE_DOC, hidden);
  if (drag > 0 && drag < 1)
    doc = withAnnotation(doc, {
      ...drawnBox,
      w: drawnBox.w * drag,
      h: drawnBox.h * drag,
    });
  if (text && text !== typedLabel.text)
    doc = withAnnotation(doc, { ...typedLabel, text });
  return doc;
};

const ONCE = "snapmark:intro";
/**
 * The answer for this page load, kept because asking marks the visit done: in development React
 * runs effects twice, and a second ask would answer "seen it" and cancel the drawing. Client only
 * — nothing calls this while rendering, so no server render reads or writes it.
 */
let answer: boolean | null = null;

/** Whether the figure has yet to annotate itself this visit; asking marks it done. */
export const firstVisit = () => (answer ??= askOnce());

const askOnce = () => {
  try {
    if (sessionStorage.getItem(ONCE)) return false;
    sessionStorage.setItem(ONCE, "done");
    return true;
  } catch {
    // A browser that won't keep it simply draws the figure on every visit.
    return true;
  }
};

/**
 * How much slower to run it than the times above: `?intro=3` to watch a beat closely, 1 by
 * default. The figure is the only thing it changes, so it is safe to leave in.
 */
export const introPace = () => {
  if (typeof window === "undefined") return 1;
  const asked = Number(
    new URLSearchParams(window.location.search).get("intro"),
  );
  return Number.isFinite(asked) && asked > 0 ? Math.min(20, asked) : 1;
};
