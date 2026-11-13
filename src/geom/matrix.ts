/**
 * The coordinate chain: image px ↔ screen px (CSS px in the canvas). ARCHITECTURE.md §4.
 *
 * `M` maps image px to screen px: scale, then pan. It is the only matrix the app builds; the
 * device matrix in render/view.ts is `M` with the pixel ratio in front, and nothing else
 * multiplies a coordinate by a scale.
 */

import type { Point } from "@/model/types";

export interface Camera {
  /** Screen px per image px. */
  scale: number;
  /** Where image (0, 0) sits, in screen px. */
  tx: number;
  ty: number;
}

export const M = (camera: Camera) =>
  new DOMMatrix().translateSelf(camera.tx, camera.ty).scaleSelf(camera.scale);

/** Image px → screen px: for handles, labels and the text overlay. */
export const toScreen = (camera: Camera, p: Point): Point => {
  const { x, y } = M(camera).transformPoint(p);
  return { x, y };
};

/**
 * Screen px → image px: for every pointer event. Never apply the pixel ratio here: a pointer's
 * clientX is already in CSS px, and the device matrix is for painting only.
 */
export const toImage = (camera: Camera, p: Point): Point => {
  const { x, y } = M(camera).invertSelf().transformPoint(p);
  return { x, y };
};
