/** The document, and the only place annotations change. Each change returns a new document. */

import type { Annotation, Doc, Id, Size } from "./types";

/** A document over an image of this size, painted in the order given (bottom first). */
export const createDoc = (
  natural: Size,
  annotations: readonly Annotation[] = [],
  {
    openedAt = new Date(),
    editedAt = null,
  }: { openedAt?: Date; editedAt?: Date | null } = {},
): Doc => ({
  naturalWidth: natural.w,
  naturalHeight: natural.h,
  byId: new Map(annotations.map((a) => [a.id, a])),
  order: annotations.map((a) => a.id),
  openedAt,
  editedAt,
});

/** The annotations in paint order, bottom first. */
export const annotations = (doc: Doc) =>
  doc.order
    .map((id) => doc.byId.get(id))
    .filter((a): a is Annotation => a !== undefined);

/** The same document without some annotations: what the layer list's eye buttons hide. */
export const withoutIds = (doc: Doc, hidden: ReadonlySet<Id>): Doc =>
  hidden.size === 0
    ? doc
    : { ...doc, order: doc.order.filter((id) => !hidden.has(id)) };

const edited = (
  doc: Doc,
  byId: Map<Id, Annotation>,
  order: readonly Id[],
): Doc => ({
  ...doc,
  byId,
  order,
  editedAt: new Date(),
});

/** Add on top of everything. */
export const addAnnotation = (doc: Doc, a: Annotation): Doc =>
  edited(doc, new Map(doc.byId).set(a.id, a), [...doc.order, a.id]);

export const updateAnnotation = (
  doc: Doc,
  id: Id,
  patch: Partial<Annotation>,
): Doc => {
  const a = doc.byId.get(id);
  if (!a) return doc;
  return edited(
    doc,
    new Map(doc.byId).set(id, { ...a, ...patch } as Annotation),
    doc.order,
  );
};

export const removeAnnotations = (doc: Doc, ids: ReadonlySet<Id>): Doc => {
  const byId = new Map(doc.byId);
  for (const id of ids) byId.delete(id);
  return edited(
    doc,
    byId,
    doc.order.filter((id) => !ids.has(id)),
  );
};

export const translated = (
  a: Annotation,
  dx: number,
  dy: number,
): Annotation =>
  a.kind === "arrow"
    ? { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy }
    : { ...a, x: a.x + dx, y: a.y + dy };

/** For previews: the document with one annotation replaced or added. */
export const withAnnotation = (doc: Doc, a: Annotation): Doc => {
  const byId = new Map(doc.byId).set(a.id, a);
  return {
    ...doc,
    byId,
    order: doc.byId.has(a.id) ? doc.order : [...doc.order, a.id],
  };
};
