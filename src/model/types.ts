/**
 * ALL geometry is image space.
 *
 * Every coordinate and length stored in a document is in the source image's natural pixels, as an
 * unrounded float. Nothing in the model knows the zoom, the viewport or the device pixel ratio, so
 * export is the same scene drawn at natural size (ARCHITECTURE.md §1, §3). Screen-space quantities
 * (handle sizes, hit tolerances, drag thresholds) are converted at the point of use, never stored.
 */

import type { SwatchId } from "./palette";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export type Id = string;

interface Base {
  id: Id;
  color: SwatchId;
  /** Image px, so it exports at this width at any zoom. */
  strokeWidth: number;
  /** 0..1 */
  opacity: number;
}

export interface RectA extends Base {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArrowA extends Base {
  kind: "arrow";
  /** Tail. */
  x1: number;
  y1: number;
  /** Tip. */
  x2: number;
  y2: number;
}

/** Drawn with multiply, like a marker, so what is underneath stays readable. */
export interface HighlightA extends Base {
  kind: "highlight";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextA extends Base {
  kind: "text";
  /** Top-left of the first line. */
  x: number;
  y: number;
  /** Wrap width. */
  width: number;
  text: string;
  fontSize: number;
  /** A dark plate behind the text, so it reads on any photo. */
  plate: boolean;
}

/** Kept live: recomputed from the source pixels on every draw, never baked into the bitmap. */
export interface PixelateA extends Base {
  kind: "pixelate";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Block size. */
  block: number;
}

export type Annotation = RectA | ArrowA | HighlightA | TextA | PixelateA;

export interface Doc {
  naturalWidth: number;
  naturalHeight: number;
  byId: ReadonlyMap<Id, Annotation>;
  /** Paint order, bottom to top. */
  order: readonly Id[];
  openedAt: Date;
  /** Null until something is drawn. */
  editedAt: Date | null;
}
