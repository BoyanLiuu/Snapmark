import type { Annotation, Doc, Id, Size } from "./types";

/** A document over an image of this size, painted in the order given (bottom first). */
export const createDoc = (
  natural: Size,
  annotations: readonly Annotation[] = [],
): Doc => ({
  naturalWidth: natural.w,
  naturalHeight: natural.h,
  byId: new Map(annotations.map((a) => [a.id, a])),
  order: annotations.map((a) => a.id),
});

/** The same document without some annotations: what the layer list's eye buttons hide. */
export const withoutIds = (doc: Doc, hidden: ReadonlySet<Id>): Doc =>
  hidden.size === 0
    ? doc
    : { ...doc, order: doc.order.filter((id) => !hidden.has(id)) };

/** The annotations in paint order, bottom first. */
export const annotations = (doc: Doc) =>
  doc.order
    .map((id) => doc.byId.get(id))
    .filter((a): a is Annotation => a !== undefined);
