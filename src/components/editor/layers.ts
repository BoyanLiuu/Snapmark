/**
 * The layer list's rows, read from the document: top of the paint order first, each named the way
 * the design file names them (text by its words, shapes by colour and kind) with its size in image
 * px.
 */

import { annotations } from "@/model/doc";
import { swatch } from "@/model/palette";
import type { Annotation, Doc, Id } from "@/model/types";

export interface LayerRow {
  id: Id;
  kind: Annotation["kind"];
  name: string;
  dims: string;
}

const KIND_NAMES = {
  rect: "rectangle",
  arrow: "arrow",
  highlight: "highlight",
} as const;

const nameOf = (a: Annotation) => {
  if (a.kind === "text") return a.text;
  if (a.kind === "pixelate") return "Pixelate";
  return `${swatch(a.color).label} ${KIND_NAMES[a.kind]}`;
};

const size = (w: number, h: number) => `${Math.round(w)} × ${Math.round(h)}`;

const dimsOf = (a: Annotation) => {
  if (a.kind === "text") return `${Math.round(a.width)} wide`;
  if (a.kind === "arrow")
    return size(Math.abs(a.x2 - a.x1), Math.abs(a.y2 - a.y1));
  return size(a.w, a.h);
};

export const layerRows = (doc: Doc): LayerRow[] =>
  annotations(doc)
    .reverse()
    .map((a) => ({ id: a.id, kind: a.kind, name: nameOf(a), dims: dimsOf(a) }));
