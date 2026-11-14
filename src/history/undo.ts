/**
 * Undo by operation (ARCHITECTURE.md §9): each entry holds only what one change touched, the
 * annotations' before and after and the paint order if it moved, never a snapshot of the document.
 * Changes in one group (a slider being dragged) merge into one entry until the group is sealed.
 */

import type { Annotation, Doc, Id } from "@/model/types";

const LIMIT = 100;

interface Change {
  id: Id;
  before: Annotation | undefined;
  after: Annotation | undefined;
}

export interface Entry {
  label: string;
  changes: Change[];
  order: { before: readonly Id[]; after: readonly Id[] } | null;
  group: string | null;
  open: boolean;
}

export interface History {
  past: readonly Entry[];
  future: readonly Entry[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };

const sameOrder = (a: readonly Id[], b: readonly Id[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

const diff = (prev: Doc, next: Doc) => {
  const changes: Change[] = [];
  for (const id of new Set([...prev.byId.keys(), ...next.byId.keys()])) {
    const before = prev.byId.get(id);
    const after = next.byId.get(id);
    if (before !== after) changes.push({ id, before, after });
  }
  const order = sameOrder(prev.order, next.order)
    ? null
    : { before: prev.order, after: next.order };
  return { changes, order };
};

/** Record `prev` → `next`. With a `group`, a run of changes in that group is one entry. */
export const record = (
  h: History,
  prev: Doc,
  next: Doc,
  label: string,
  group?: string,
): History => {
  const { changes, order } = diff(prev, next);
  if (changes.length === 0 && !order) return h;
  const top = h.past.at(-1);
  if (group && top?.open && top.group === group) {
    const merged = new Map(top.changes.map((c) => [c.id, c]));
    for (const c of changes)
      merged.set(c.id, { ...c, before: merged.get(c.id)?.before ?? c.before });
    const entry = {
      ...top,
      changes: [...merged.values()],
      order: order
        ? { before: top.order?.before ?? order.before, after: order.after }
        : top.order,
    };
    return { past: [...h.past.slice(0, -1), entry], future: [] };
  }
  const entry = {
    label,
    changes,
    order,
    group: group ?? null,
    open: Boolean(group),
  };
  return { past: [...h.past, entry].slice(-LIMIT), future: [] };
};

/** End the current group, so the next change in it starts a new entry. */
export const seal = (h: History): History => {
  const top = h.past.at(-1);
  return top?.open
    ? { ...h, past: [...h.past.slice(0, -1), { ...top, open: false }] }
    : h;
};

const apply = (doc: Doc, e: Entry, side: "before" | "after"): Doc => {
  const byId = new Map(doc.byId);
  for (const c of e.changes) {
    const a = c[side];
    if (a) byId.set(c.id, a);
    else byId.delete(c.id);
  }
  return {
    ...doc,
    byId,
    order: e.order ? e.order[side] : doc.order,
    editedAt: new Date(),
  };
};

export const undo = (h: History, doc: Doc): [History, Doc] | null => {
  const e = h.past.at(-1);
  if (!e) return null;
  return [
    { past: h.past.slice(0, -1), future: [{ ...e, open: false }, ...h.future] },
    apply(doc, e, "before"),
  ];
};

export const redo = (h: History, doc: Doc): [History, Doc] | null => {
  const [e, ...rest] = h.future;
  if (!e) return null;
  return [{ past: [...h.past, e], future: rest }, apply(doc, e, "after")];
};
