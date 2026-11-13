/** The layer list's rows, read from the document, top of the paint order first. */

import { dimsOf, nameOf } from "@/model/describe";
import { annotations } from "@/model/doc";
import type { Annotation, Doc, Id } from "@/model/types";

export interface LayerRow {
  id: Id;
  kind: Annotation["kind"];
  name: string;
  dims: string;
}

export const layerRows = (doc: Doc): LayerRow[] =>
  annotations(doc)
    .reverse()
    .map((a) => ({ id: a.id, kind: a.kind, name: nameOf(a), dims: dimsOf(a) }));
