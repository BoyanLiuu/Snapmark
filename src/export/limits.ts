/**
 * What the browser will draw (ARCHITECTURE.md §6, Canvas size limits). Engines cap a canvas's
 * sides and area and, past them, hand back a blank one rather than failing. Snapmark stays inside
 * a 64 MP budget and 16,384 px a side, Safari's desktop cap, the lowest of the desktop engines;
 * on an iPhone or iPad, 16 MP and 4,096 px, the low end of iOS Safari's device-dependent caps.
 */

import type { Size } from "@/model/types";

export interface Caps {
  budgetMP: number;
  maxSide: number;
}

const DESKTOP: Caps = { budgetMP: 64, maxSide: 16_384 };
const IOS: Caps = { budgetMP: 16, maxSide: 4_096 };

/** iOS Safari, on a phone or an iPad that calls itself a Mac. */
export const canvasCaps = (): Caps => {
  if (typeof navigator === "undefined") return DESKTOP;
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
  return ios ? IOS : DESKTOP;
};

export interface ExportSize extends Size {
  /** Export px per image px: 1, or less when the image is over the budget. */
  scale: number;
}

/** The size an image exports at: its own, or scaled down by √(budget ÷ area) to fit. */
export const exportSize = (
  { w, h }: Size,
  { budgetMP, maxSide }: Caps = canvasCaps(),
): ExportSize => {
  const scale = Math.min(
    1,
    Math.sqrt((budgetMP * 1e6) / (w * h)),
    maxSide / w,
    maxSide / h,
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
