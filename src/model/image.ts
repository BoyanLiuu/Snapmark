/**
 * Opening an image: tell what a file is from its first bytes, then decode it upright.
 *
 * The bytes decide, not the name or the MIME type: a pasted screenshot arrives as "image.png"
 * whatever it is, and a renamed HEIC is still HEIC. Snapmark opens PNG, JPEG and WebP, the formats
 * every browser decodes and exports, and refuses the rest by name rather than showing an empty
 * canvas (ARCHITECTURE.md §11).
 */

import type { Size } from "./types";

export type Format =
  "png" | "jpeg" | "webp" | "gif" | "heic" | "avif" | "tiff" | "bmp" | "svg";

const FORMAT_NAMES: Record<Format, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  gif: "GIF",
  heic: "HEIC",
  avif: "AVIF",
  tiff: "TIFF",
  bmp: "BMP",
  svg: "SVG",
};

const OPENS: ReadonlySet<Format> = new Set(["png", "jpeg", "webp"]);

/** How many leading bytes `sniffFormat` needs. */
const SNIFF_BYTES = 32;

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((byte, i) => bytes[i] === byte);

/** HEIF/AVIF: an ISO box `ftyp` at offset 4, then the major brand. */
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
]);
const AVIF_BRANDS = new Set(["avif", "avis"]);

export const sniffFormat = (bytes: Uint8Array): Format | null => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP")
    return "webp";
  if (ascii(bytes, 0, 4) === "GIF8") return "gif";
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (AVIF_BRANDS.has(brand)) return "avif";
    if (HEIF_BRANDS.has(brand)) return "heic";
  }
  if (
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])
  )
    return "tiff";
  if (ascii(bytes, 0, 2) === "BM") return "bmp";
  if (/^\s*(<\?xml|<svg)/i.test(ascii(bytes, 0, bytes.length))) return "svg";
  return null;
};

export interface LoadedImage {
  /** As the user knows it: the file's name, or a stand-in for a pasted image. */
  name: string;
  bitmap: ImageBitmap;
  /** Natural size, in image px, after the photo's own orientation is applied. */
  natural: Size;
}

export type OpenResult =
  { ok: true; image: LoadedImage } | { ok: false; reason: string };

const ACCEPTED =
  "Snapmark opens PNG, JPEG and WebP: save it as one of those and try again.";

export const decodeImage = async (
  blob: Blob,
  name: string,
): Promise<OpenResult> => {
  const head = new Uint8Array(await blob.slice(0, SNIFF_BYTES).arrayBuffer());
  const format = sniffFormat(head);
  if (!format)
    return {
      ok: false,
      reason: `${name} isn’t an image Snapmark can read. ${ACCEPTED}`,
    };
  if (!OPENS.has(format))
    return {
      ok: false,
      reason: `${name} is a ${FORMAT_NAMES[format]} image. ${ACCEPTED}`,
    };
  try {
    // from-image applies the photo's EXIF orientation, so image space is what the user sees.
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: "from-image",
    });
    return {
      ok: true,
      image: { name, bitmap, natural: { w: bitmap.width, h: bitmap.height } },
    };
  } catch {
    return {
      ok: false,
      reason: `${name} looks like a ${FORMAT_NAMES[format]} but couldn’t be decoded; the file may be damaged.`,
    };
  }
};
