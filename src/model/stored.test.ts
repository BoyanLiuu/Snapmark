import { describe, expect, it } from "vitest";
import { rect } from "@/test/shapes";
import { annotations, createDoc } from "./doc";
import { fromStored, toStored } from "./stored";

const natural = { w: 400, h: 300 };
const doc = createDoc(
  natural,
  [
    rect("a", { x: 1.5, y: 2, w: 30, h: 40 }),
    rect("b", { x: 9, y: 9, w: 9, h: 9 }),
  ],
  { openedAt: new Date(1000), editedAt: new Date(2000) },
);

describe("the stored document", () => {
  it("comes back as it went in: annotations, paint order and dates", () => {
    // Through structured clone, as IndexedDB keeps it.
    const back = fromStored(structuredClone(toStored("h", doc)), natural)!;
    expect(annotations(back)).toEqual(annotations(doc));
    expect(back.order).toEqual(["a", "b"]);
    expect([back.openedAt, back.editedAt]).toEqual([
      doc.openedAt,
      doc.editedAt,
    ]);
  });

  it("is refused, not half-read, from another version or with a kind this one doesn't know", () => {
    const stored = toStored("h", doc);
    expect(fromStored({ ...stored, schemaVersion: 2 }, natural)).toBeNull();
    expect(
      fromStored(
        { ...stored, annotations: [{ id: "c", kind: "pen" }] },
        natural,
      ),
    ).toBeNull();
  });
});
