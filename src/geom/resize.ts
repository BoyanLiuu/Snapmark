/**
 * Resizing by eight handles (ARCHITECTURE.md §7). Each drag is computed from the box it started
 * with: the opposite corner or edge stays put and the grabbed one follows the pointer, so dragging
 * past the anchor flips the box and the handle under the pointer becomes its mirror.
 */

import type { Box } from "@/model/bbox";
import type { Point } from "@/model/types";

export type BoxHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const HANDLES: readonly BoxHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

export const handlePoint = (box: Box, handle: BoxHandle): Point => ({
  x: handle.includes("w")
    ? box.x
    : handle.includes("e")
      ? box.x + box.w
      : box.x + box.w / 2,
  y: handle.includes("n")
    ? box.y
    : handle.includes("s")
      ? box.y + box.h
      : box.y + box.h / 2,
});

const sign = (v: number, fallback: number) =>
  v === 0 ? fallback : Math.sign(v);

/**
 * The box after dragging `handle` to `p`, and the handle the pointer now holds. With `keepAspect`
 * a corner keeps the start's proportions, the larger change winning.
 */
export const resize = (
  start: Box,
  handle: BoxHandle,
  p: Point,
  keepAspect = false,
): { box: Box; handle: BoxHandle } => {
  const horizontal = handle.includes("w") || handle.includes("e");
  const vertical = handle.includes("n") || handle.includes("s");
  const anchor = {
    x: handle.includes("w") ? start.x + start.w : start.x,
    y: handle.includes("n") ? start.y + start.h : start.y,
  };
  let dx = horizontal ? p.x - anchor.x : start.w;
  let dy = vertical ? p.y - anchor.y : start.h;
  if (keepAspect && horizontal && vertical && start.w > 0 && start.h > 0) {
    const s = Math.max(Math.abs(dx) / start.w, Math.abs(dy) / start.h);
    dx = sign(dx, handle.includes("w") ? -1 : 1) * s * start.w;
    dy = sign(dy, handle.includes("n") ? -1 : 1) * s * start.h;
  }
  const live =
    `${vertical ? (dy < 0 ? "n" : "s") : ""}${horizontal ? (dx < 0 ? "w" : "e") : ""}` as BoxHandle;
  return {
    box: {
      x: Math.min(anchor.x, anchor.x + dx),
      y: Math.min(anchor.y, anchor.y + dy),
      w: Math.abs(dx),
      h: Math.abs(dy),
    },
    handle: live,
  };
};
