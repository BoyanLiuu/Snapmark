/**
 * A document as this browser keeps it (ARCHITECTURE.md §3, Persistence): plain data, the
 * annotations in paint order, filed under the hash of the image's bytes.
 */

import { KIND_LABEL } from "./describe";
import { annotations, createDoc } from "./doc";
import type { Annotation, Doc, Size } from "./types";

const SCHEMA_VERSION = 1;

export interface StoredDoc {
  hash: string;
  schemaVersion: number;
  annotations: Annotation[];
  openedAt: number;
  editedAt: number | null;
}

export const toStored = (hash: string, doc: Doc): StoredDoc => ({
  hash,
  schemaVersion: SCHEMA_VERSION,
  annotations: annotations(doc),
  openedAt: doc.openedAt.getTime(),
  editedAt: doc.editedAt?.getTime() ?? null,
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const readable = (a: unknown): a is Annotation =>
  isObject(a) &&
  typeof a.id === "string" &&
  typeof a.kind === "string" &&
  Object.hasOwn(KIND_LABEL, a.kind);

/** The document back, or null when the record isn't one this version can read. */
export const fromStored = (record: unknown, natural: Size): Doc | null => {
  if (
    !isObject(record) ||
    record.schemaVersion !== SCHEMA_VERSION ||
    typeof record.openedAt !== "number" ||
    !Array.isArray(record.annotations) ||
    !record.annotations.every(readable)
  )
    return null;
  return createDoc(natural, record.annotations, {
    openedAt: new Date(record.openedAt),
    editedAt:
      typeof record.editedAt === "number" ? new Date(record.editedAt) : null,
  });
};
