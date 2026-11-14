/**
 * What the browser will draw (ARCHITECTURE.md §6, Canvas size limits). Engines cap a canvas's
 * sides and area and, past them, hand back a blank one rather than failing. Snapmark stays inside
 * a 64 MP budget and 16,384 px a side, Safari's desktop cap, the lowest of the desktop engines;
 * the phone's lower caps come with M19.
 */

import type { Size } from "@/model/types";

export const BUDGET_MP = 64;
const MAX_SIDE = 16_384;

export interface ExportSize extends Size {
  /** Export px per image px: 1, or less when the image is over the budget. */
  scale: number;
}

/** The size an image exports at: its own, or scaled down by √(budget ÷ area) to fit. */
export const exportSize = ({ w, h }: Size): ExportSize => {
  const scale = Math.min(
    1,
    Math.sqrt((BUDGET_MP * 1e6) / (w * h)),
    MAX_SIDE / w,
    MAX_SIDE / h,
  );
  return {
    w: Math.max(1, Math.floor(w * scale)),
    h: Math.max(1, Math.floor(h * scale)),
    scale,
  };
};

/** Whether the page may read this image's pixels: a tainted canvas would throw at the export. */
export const readable = (bitmap: ImageBitmap) => {
  try {
    const ctx = new OffscreenCanvas(1, 1).getContext("2d");
    ctx?.drawImage(bitmap, 0, 0, 1, 1);
    ctx?.getImageData(0, 0, 1, 1);
    return ctx !== null;
  } catch {
    return false;
  }
};
