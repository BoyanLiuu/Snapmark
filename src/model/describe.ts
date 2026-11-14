/**
 * How an annotation is named and measured where people read it: the layer list, the inspector and
 * the size tag. Text by its words, shapes by colour and kind, sizes in image px.
 */

import { arrowLength } from "@/geom/arrow";
import { swatch } from "./palette";
import type { Annotation } from "./types";

export const KIND_LABEL: Record<Annotation["kind"], string> = {
  rect: "Rectangle",
  arrow: "Arrow",
  highlight: "Highlight",
  text: "Text",
  pixelate: "Pixelate",
};

export const annotationCount = (n: number) =>
  `${n} annotation${n === 1 ? "" : "s"}`;

export const nameOf = (a: Annotation) => {
  if (a.kind === "text") return a.text;
  if (a.kind === "pixelate") return "Pixelate";
  return `${swatch(a.color).label} ${KIND_LABEL[a.kind].toLowerCase()}`;
};

const size = (w: number, h: number) => `${Math.round(w)} × ${Math.round(h)}`;

export const dimsOf = (a: Annotation) => {
  if (a.kind === "text") return `${Math.round(a.width)} wide`;
  if (a.kind === "arrow")
    return size(Math.abs(a.x2 - a.x1), Math.abs(a.y2 - a.y1));
  return size(a.w, a.h);
};

/** The selection's size tag: an arrow by its length, everything else by its size. */
export const tagOf = (a: Annotation) =>
  a.kind === "arrow" ? `${Math.round(arrowLength(a))} px` : dimsOf(a);
