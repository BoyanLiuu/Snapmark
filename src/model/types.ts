/**
 * ALL geometry is image space.
 *
 * Every coordinate and length stored in a document is in the source image's natural pixels, as an
 * unrounded float. Nothing in the model knows the zoom, the viewport or the device pixel ratio, so
 * export is the same scene drawn at natural size (ARCHITECTURE.md §1, §3). Screen-space quantities
 * (handle sizes, hit tolerances, drag thresholds) are converted at the point of use, never stored.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}
