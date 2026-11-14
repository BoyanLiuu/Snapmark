import { describe, expect, it } from "vitest";
import {
  addAnnotation,
  annotations,
  createDoc,
  removeAnnotations,
  updateAnnotation,
} from "@/model/doc";
import type { Doc } from "@/model/types";
import { rect } from "@/test/shapes";
import { EMPTY_HISTORY, record, redo, seal, undo, type History } from "./undo";

type Edit = [(d: Doc) => Doc, string, string?];

const box = rect("b", { x: 0, y: 0, w: 10, h: 10 });
const draw: Edit = [(d) => addAnnotation(d, box), "Draw"];
const opacity = (o: number): Edit => [
  (d) => updateAnnotation(d, "b", { opacity: o }),
  "Restyle",
  "opacity:b",
];

/** Apply edits in turn, recording each, as the editor does. */
const run = (
  edits: Edit[],
  from: [History, Doc] = [EMPTY_HISTORY, createDoc({ w: 100, h: 100 })],
) =>
  edits.reduce<[History, Doc]>(([h, d], [fn, label, group]) => {
    const next = fn(d);
    return [record(h, d, next, label, group), next];
  }, from);

describe("undo", () => {
  it("steps back through add, move and delete one operation at a time, and forward again", () => {
    const [h, end] = run([
      draw,
      [(d) => updateAnnotation(d, "b", { x: 50 }), "Move"],
      [(d) => removeAnnotations(d, new Set(["b"])), "Delete"],
    ]);
    const [h1, d1] = undo(h, end)!;
    expect(annotations(d1)).toMatchObject([{ x: 50 }]);
    const [h2, d2] = undo(h1, d1)!;
    expect(annotations(d2)).toMatchObject([{ x: 0 }]);
    const [h3, d3] = undo(h2, d2)!;
    expect(d3.order).toEqual([]);
    expect(undo(h3, d3)).toBeNull();
    const [, d4] = redo(...redo(h3, d3)!)!;
    expect(annotations(d4)).toEqual(annotations(d1));
  });

  it("a slider drag is one entry; a second drag after it is sealed is another", () => {
    const [dragged, d] = run([draw, opacity(0.9), opacity(0.6), opacity(0.3)]);
    const [h, end] = run([opacity(0.1)], [seal(dragged), d]);
    expect(h.past).toHaveLength(3);
    const [h1, d1] = undo(h, end)!;
    expect(annotations(d1)).toMatchObject([{ opacity: 0.3 }]);
    expect(annotations(undo(h1, d1)![1])).toMatchObject([{ opacity: 1 }]);
  });

  it("a new change after undo drops what could have been redone", () => {
    const [h, d] = undo(...run([draw]))!;
    const [after] = run(
      [[(x) => addAnnotation(x, { ...box, id: "c" }), "Draw"]],
      [h, d],
    );
    expect(after.future).toEqual([]);
  });
});
