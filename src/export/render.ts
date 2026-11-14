/**
 * The export (ARCHITECTURE.md §6): the document drawn again at the image's own size, on a canvas
 * of its own, so an image pixel is a PNG pixel. Never the view, so neither the zoom nor the
 * screen's pixel ratio can reach the file. Over the budget it is drawn smaller, by one scale.
 */

import type { Doc } from "@/model/types";
import { drawScene } from "@/render/scene";
import { exportSize } from "./limits";

export type ImageType = "image/png" | "image/jpeg";

export const renderImage = async (
  doc: Doc,
  bitmap: ImageBitmap,
  type: ImageType = "image/png",
  quality?: number,
) => {
  // Text measured before a webfont arrives would wrap differently from the view.
  await document.fonts.ready;
  const size = exportSize({ w: doc.naturalWidth, h: doc.naturalHeight });
  const canvas = new OffscreenCanvas(size.w, size.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser has no 2D canvas to export with.");
  if (size.scale < 1) ctx.scale(size.scale, size.scale);
  drawScene(ctx, doc, bitmap, { minVisualStroke: 0 });
  // A Blob, encoded off the main thread; never toDataURL.
  return canvas.convertToBlob({ type, quality });
};

export const renderPng = (doc: Doc, bitmap: ImageBitmap) =>
  renderImage(doc, bitmap);

/** `Market-at-Third.jpg` exports as `Market-at-Third-annotated.png`, or `.jpg`, or `.json`. */
export const exportName = (name: string, extension = "png") =>
  `${name.replace(/\.[^.]+$/, "")}-annotated.${extension}`;
