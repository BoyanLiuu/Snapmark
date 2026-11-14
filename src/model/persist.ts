/**
 * This browser's library (ARCHITECTURE.md §3, Persistence): IndexedDB, an image store and a
 * document store, both keyed by the SHA-256 of the image's bytes.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { StoredDoc } from "./stored";
import type { Size } from "./types";

export interface StoredImage {
  hash: string;
  name: string;
  natural: Size;
  blob: Blob;
  thumb: Blob;
  sample: boolean;
  addedAt: number;
}

export interface LibraryItem {
  hash: string;
  name: string;
  natural: Size;
  thumb: Blob;
  count: number;
  /** When it was last edited, or opened if nothing has been drawn. */
  at: number;
}

interface Schema extends DBSchema {
  images: { key: string; value: StoredImage };
  docs: { key: string; value: StoredDoc };
}

let opening: Promise<IDBPDatabase<Schema>> | null = null;

/** Rejects where storage is blocked (a private window, a denied quota); the next call tries again. */
const db = () =>
  (opening ??= Promise.resolve()
    .then(() =>
      openDB<Schema>("snapmark", 1, {
        upgrade: (d) => {
          d.createObjectStore("images", { keyPath: "hash" });
          d.createObjectStore("docs", { keyPath: "hash" });
        },
      }),
    )
    .catch((error: unknown) => {
      opening = null;
      throw error;
    }));

export const listLibrary = async (): Promise<LibraryItem[]> => {
  const d = await db();
  const [images, docs] = await Promise.all([
    d.getAll("images"),
    d.getAll("docs"),
  ]);
  const docOf = new Map(docs.map((doc) => [doc.hash, doc]));
  return images
    .map(({ hash, name, natural, thumb, addedAt }) => {
      const doc = docOf.get(hash);
      return {
        hash,
        name,
        natural,
        thumb,
        count: Array.isArray(doc?.annotations) ? doc.annotations.length : 0,
        at: doc?.editedAt ?? doc?.openedAt ?? addedAt,
      };
    })
    .sort((a, b) => b.at - a.at);
};

/** The image whose hash starts with this address's key. */
export const findImage = async (key: string) =>
  (
    await (
      await db()
    ).getAll("images", IDBKeyRange.bound(key, `${key}\uffff`), 1)
  )[0];

/** Undefined when nothing is stored, or storage is blocked; rejects when the store fails to answer. */
export const readDoc = async (hash: string): Promise<unknown> => {
  const d = await db().catch(() => null);
  return d?.get("docs", hash);
};

/** The image is written once; opening the same bytes again keeps the first record. */
export const keepImage = async (image: StoredImage) => {
  const tx = (await db()).transaction("images", "readwrite");
  if (!(await tx.store.getKey(image.hash))) await tx.store.put(image);
  await tx.done;
};

export const saveDoc = async (doc: StoredDoc) => {
  await (await db()).put("docs", doc);
};

export const forgetImage = async (hash: string) => {
  const tx = (await db()).transaction(["images", "docs"], "readwrite");
  await Promise.all([
    tx.objectStore("images").delete(hash),
    tx.objectStore("docs").delete(hash),
    tx.done,
  ]);
};
