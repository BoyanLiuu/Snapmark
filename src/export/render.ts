/**
 * The export (ARCHITECTURE.md §6): the document drawn again at the image's own size, on a canvas
 * of its own whose transform is the identity, so an image pixel is a PNG pixel. Never the view, so
 * neither the zoom nor the screen's pixel ratio can reach the file.
 */

import type { Doc } from "@/model/types";
import { drawScene } from "@/render/scene";

export const renderPng = async (doc: Doc, bitmap: ImageBitmap) => {
  // Text measured before a webfont arrives would wrap differently from the view.
  await document.fonts.ready;
  const canvas = new OffscreenCanvas(doc.naturalWidth, doc.naturalHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser has no 2D canvas to export with.");
  drawScene(ctx, doc, bitmap, { minVisualStroke: 0 });
  // A Blob, encoded off the main thread; never toDataURL.
  return canvas.convertToBlob({ type: "image/png" });
};

/** `Market-at-Third.jpg` exports as `Market-at-Third-annotated.png`. */
export const pngName = (name: string) =>
  `${name.replace(/\.[^.]+$/, "")}-annotated.png`;
