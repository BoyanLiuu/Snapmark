import { describe, expect, it } from "vitest";
import { annotations, createDoc } from "@/model/doc";
import { arrow, rect } from "@/test/shapes";
import { fromWebAnnotations, toWebAnnotations } from "./annotations";

const doc = createDoc({ w: 400, h: 300 }, [
  rect("a", { x: 10.25, y: 20, w: 30, h: 40 }),
  arrow("b", { x1: 1, y1: 2, x2: 300, y2: 200 }),
]);

describe("annotations as JSON", () => {
  it("come back onto the same image as they went out, through JSON", () => {
    const json = JSON.parse(JSON.stringify(toWebAnnotations(doc, "h")));
    expect(fromWebAnnotations(json, "h")).toEqual({
      ok: true,
      annotations: annotations(doc),
    });
  });

  it("are refused for another image", () => {
    const json = JSON.parse(JSON.stringify(toWebAnnotations(doc, "h")));
    expect(fromWebAnnotations(json, "other").ok).toBe(false);
  });
});
