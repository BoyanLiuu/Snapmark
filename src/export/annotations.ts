/**
 * Annotations as JSON (screen 27): W3C Web Annotations, each pointing at the image by the SHA-256
 * of its bytes, with an `xywh=pixel:` selector any reader understands and the whole annotation
 * under `snapmark:annotation`, so they can be opened onto the same picture exactly as they were.
 */

import { z } from "zod";
import { outline } from "@/model/bbox";
import { annotations } from "@/model/doc";
import { KIND_LABEL } from "@/model/describe";
import { annotationSchema } from "@/model/schema";
import type { Annotation, Doc } from "@/model/types";

const CONTEXT = "http://www.w3.org/ns/anno.jsonld";

export const toWebAnnotations = (doc: Doc, hash: string) =>
  annotations(doc).map((a) => {
    const box = outline(a);
    const xywh = [box.x, box.y, box.w, box.h].map(Math.round).join(",");
    return {
      "@context": CONTEXT,
      id: `#${a.id}`,
      type: "Annotation",
      body: [
        {
          type: "TextualBody",
          purpose: "tagging",
          value: KIND_LABEL[a.kind].toLowerCase(),
        },
        ...(a.kind === "text"
          ? [{ type: "TextualBody", purpose: "describing", value: a.text }]
          : []),
      ],
      target: {
        source: `sha256:${hash}`,
        selector: {
          type: "FragmentSelector",
          conformsTo: "http://www.w3.org/TR/media-frags/",
          value: `xywh=pixel:${xywh}`,
        },
      },
      "snapmark:annotation": a,
    };
  });

const importSchema = z.array(
  z.object({
    target: z.object({ source: z.string() }),
    "snapmark:annotation": annotationSchema,
  }),
);

/**
 * The annotations in this JSON that point at this image, in paint order; an error naming why when
 * it isn't Snapmark's, or is for another picture.
 */
export const fromWebAnnotations = (
  json: unknown,
  hash: string,
): { ok: true; annotations: Annotation[] } | { ok: false; reason: string } => {
  const parsed = importSchema.safeParse(json);
  if (!parsed.success)
    return {
      ok: false,
      reason: "That JSON isn’t annotations Snapmark exported.",
    };
  const mine = parsed.data.filter((w) => w.target.source === `sha256:${hash}`);
  if (mine.length < parsed.data.length)
    return {
      ok: false,
      reason: "Those annotations are for a different image.",
    };
  return { ok: true, annotations: mine.map((w) => w["snapmark:annotation"]) };
};
