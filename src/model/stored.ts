/**
 * A document as this browser keeps it (ARCHITECTURE.md §3, Persistence): plain data, the
 * annotations in paint order, filed under the hash of the image's bytes.
 */

import { z } from "zod";
import { annotations, createDoc } from "./doc";
import { readDoc } from "./persist";
import { annotationSchema } from "./schema";
import type { Doc, Size } from "./types";

const SCHEMA_VERSION = 1;

const storedSchema = z.object({
  hash: z.string(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  annotations: z.array(annotationSchema),
  openedAt: z.number(),
  editedAt: z.number().nullable(),
});

export type StoredDoc = z.infer<typeof storedSchema>;

export const toStored = (hash: string, doc: Doc): StoredDoc => ({
  hash,
  schemaVersion: SCHEMA_VERSION,
  annotations: annotations(doc),
  openedAt: doc.openedAt.getTime(),
  editedAt: doc.editedAt?.getTime() ?? null,
});

/** The document back, or null when the record isn't one this version can read. */
export const fromStored = (record: unknown, natural: Size): Doc | null => {
  const parsed = storedSchema.safeParse(record);
  if (!parsed.success) return null;
  const { openedAt, editedAt } = parsed.data;
  return createDoc(natural, parsed.data.annotations, {
    openedAt: new Date(openedAt),
    editedAt: editedAt === null ? null : new Date(editedAt),
  });
};

/** The stored annotations, or `fresh` when there are none; `unreadable` when they can't be read (screen 11). */
export const readStored = async (hash: string, natural: Size, fresh: Doc) => {
  try {
    const stored = await readDoc(hash);
    if (stored === undefined) return { doc: fresh, unreadable: false };
    const doc = fromStored(stored, natural);
    return { doc: doc ?? fresh, unreadable: !doc };
  } catch {
    return { doc: fresh, unreadable: true };
  }
};
