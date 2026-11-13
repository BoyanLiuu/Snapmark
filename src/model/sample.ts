/**
 * The sample photo: rowboats on Lago di Braies, with crisp numbers and edges to box and read at
 * any zoom. Served from this app (public/samples/), so opening it fetches nothing from elsewhere,
 * and decoded the same way as a file you choose.
 */

import { createDoc } from "./doc";
import { decodeImage, type OpenResult } from "./image";
import type { Annotation, Point } from "./types";

export const SAMPLE = {
  url: "/samples/lago-di-braies.webp",
  name: "Lago-di-Braies.webp",
  /** Natural size, in image px, known before the file arrives. */
  size: { w: 4554, h: 3036 },
  /**
   * The signature pixel: the top-left corner of the box around boat 14's number, read the same at
   * the fitted zoom, at 400% and in the PNG.
   */
  pixel: { x: 2112, y: 2630 } satisfies Point,
  credit: {
    title: "Lago di Braies",
    author: "Luca Bravo",
    source:
      "https://commons.wikimedia.org/wiki/File:Lago_di_Braies_(Unsplash_VowIFDxogG4).jpg",
    licence: "CC0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
} as const;

export const loadSample = async (): Promise<OpenResult> => {
  const response = await fetch(SAMPLE.url).catch(() => null);
  if (!response?.ok)
    return {
      ok: false,
      reason: "The sample didn’t load. Reload the page and try again.",
    };
  return decodeImage(await response.blob(), SAMPLE.name);
};

/** Defaults for this image's width: width ÷ 400 for strokes (ARCHITECTURE.md §3). */
const stroke = { strokeWidth: 11, opacity: 1 };
const label = { color: "white", fontSize: 56, plate: true, ...stroke } as const;

/**
 * What the sample shows on first open: one of each kind of annotation, on what it describes, in
 * image px. Paint order, bottom first.
 */
const SAMPLE_ANNOTATIONS: Annotation[] = [
  // Redact the letter on the next boat.
  {
    id: "p7Lm2Qx8",
    kind: "pixelate",
    color: "white",
    x: 2492,
    y: 2642,
    w: 72,
    h: 64,
    block: 12,
    ...stroke,
  },
  // The pale beach on the far shore, marked like a highlighter pen: multiply shows on light ground.
  {
    id: "Mz6Yb1Tq",
    kind: "highlight",
    color: "yellow",
    x: 2400,
    y: 2056,
    w: 560,
    h: 52,
    strokeWidth: 11,
    opacity: 0.6,
  },
  {
    id: "Ce2Nj5Vu",
    kind: "rect",
    color: "orange",
    x: 150,
    y: 1530,
    w: 980,
    h: 400,
    ...stroke,
  },
  {
    id: "k3Fq9aZ1",
    kind: "rect",
    color: "sky",
    x: 2112,
    y: 2630,
    w: 84,
    h: 68,
    ...stroke,
  },
  {
    id: "Hv8Rc3Ks",
    kind: "arrow",
    color: "sky",
    x1: 2760,
    y1: 2390,
    x2: 2208,
    y2: 2620,
    ...stroke,
  },
  {
    id: "Ra9Kx4Pd",
    kind: "text",
    text: "Boat 14, the one we rented",
    x: 2660,
    y: 2250,
    width: 900,
    ...label,
  },
  {
    id: "Xt4Wd9Bn",
    kind: "text",
    text: "Oars and life jackets in the boathouse",
    x: 190,
    y: 1300,
    width: 760,
    ...label,
  },
];

export const SAMPLE_DOC = createDoc(SAMPLE.size, SAMPLE_ANNOTATIONS);

/** The sample's made-up history, for the status line. */
export const SAMPLE_EDITED = "12 Nov 2026, 09:41 UTC";
