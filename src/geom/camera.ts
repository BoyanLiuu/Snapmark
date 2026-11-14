import type { Point, Size } from "@/model/types";
import type { Box } from "@/model/bbox";
import { toImage, type Camera } from "./matrix";

/** A fitted image fills 95% of its limiting axis, leaving breathing room around it. */
const BREATHING = 0.95;

/** The camera that shows the whole image, centred in the view. */
export const fit = (nat: Size, view: Size, breathing = BREATHING): Camera => {
  const scale = Math.min(view.w / nat.w, view.h / nat.h) * breathing;
  return {
    scale,
    tx: (view.w - nat.w * scale) / 2,
    ty: (view.h - nat.h * scale) / 2,
  };
};

/** The camera that shows the whole of `box`, centred: the image and anything drawn past it. */
export const fitBox = (box: Box, view: Size, breathing = BREATHING): Camera => {
  const scale = Math.min(view.w / box.w, view.h / box.h) * breathing;
  return {
    scale,
    tx: (view.w - box.w * scale) / 2 - box.x * scale,
    ty: (view.h - box.h * scale) / 2 - box.y * scale,
  };
};

/** The camera at `scale` that puts image point `p` at the centre of the view. */
export const centreOn = (p: Point, scale: number, view: Size): Camera => ({
  scale,
  tx: view.w / 2 - p.x * scale,
  ty: view.h / 2 - p.y * scale,
});

/** 10% to 800%: past either end, a pixel is either unseeable or the whole view. */
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

/**
 * Zoom by `k` keeping the image point under the cursor exactly under it (ARCHITECTURE.md §4):
 * the point is read before the scale changes.
 */
export const zoomAt = (cam: Camera, cursor: Point, k: number): Camera => {
  const p = toImage(cam, cursor);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.scale * k));
  return { scale, tx: cursor.x - p.x * scale, ty: cursor.y - p.y * scale };
};

/**
 * What the view shows: the whole image, or a scale with an image point at the centre. The centre
 * stays put when the view resizes, and it is what the address records (`?zoom=400&at=x,y`).
 */
export type Zoom = "fit" | { scale: number; at?: Point };

/**
 * The camera for a zoom state; with no `at`, the image's centre. Fit takes in `extent` too, what
 * is drawn past the image's edge (M17), so nothing drawn is ever out of sight.
 */
export const cameraFor = (
  zoom: Zoom,
  nat: Size,
  view: Size,
  extent?: Box,
): Camera => {
  if (zoom !== "fit")
    return centreOn(
      zoom.at ?? { x: nat.w / 2, y: nat.h / 2 },
      zoom.scale,
      view,
    );
  return extent ? fitBox(extent, view) : fit(nat, view);
};

export const zoomOf = (cam: Camera, view: Size): Zoom => ({
  scale: cam.scale,
  at: toImage(cam, { x: view.w / 2, y: view.h / 2 }),
});
