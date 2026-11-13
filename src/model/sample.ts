/**
 * The sample photo: rowboats on Lago di Braies, with crisp numbers and edges to box and read at
 * any zoom. Served from this app (public/samples/), so opening it fetches nothing from elsewhere,
 * and decoded the same way as a file you choose.
 */

import { decodeImage, type OpenResult } from "./image";
import type { Point } from "./types";

export const SAMPLE = {
  url: "/samples/lago-di-braies.webp",
  name: "Lago-di-Braies.webp",
  /** Natural size, in image px, known before the file arrives. */
  size: { w: 4554, h: 3036 },
  /** The signature pixel: the top-left corner of the "14" on the nearest rowboat. */
  pixel: { x: 2136, y: 2651 } satisfies Point,
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
