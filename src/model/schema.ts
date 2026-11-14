/**
 * The shape annotations must have when they come from outside the running app: what this browser
 * stored, and from M16 a JSON import. Each schema is checked against its type, so they can't drift.
 */

import { z } from "zod";
import { SWATCHES, type SwatchId } from "./palette";
import type {
  Annotation,
  ArrowA,
  HighlightA,
  PixelateA,
  RectA,
  TextA,
} from "./types";

const base = {
  id: z.string(),
  color: z.enum(SWATCHES.map((s) => s.id) as [SwatchId, ...SwatchId[]]),
  strokeWidth: z.number().positive(),
  opacity: z.number().min(0).max(1),
};

const box = {
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
};

const rect = z.object({
  kind: z.literal("rect"),
  ...base,
  ...box,
}) satisfies z.ZodType<RectA>;

const arrow = z.object({
  kind: z.literal("arrow"),
  ...base,
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
}) satisfies z.ZodType<ArrowA>;

const highlight = z.object({
  kind: z.literal("highlight"),
  ...base,
  ...box,
}) satisfies z.ZodType<HighlightA>;

const text = z.object({
  kind: z.literal("text"),
  ...base,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  text: z.string(),
  fontSize: z.number().positive(),
  plate: z.boolean(),
}) satisfies z.ZodType<TextA>;

const pixelate = z.object({
  kind: z.literal("pixelate"),
  ...base,
  ...box,
  block: z.number().positive(),
}) satisfies z.ZodType<PixelateA>;

export const annotationSchema = z.discriminatedUnion("kind", [
  rect,
  arrow,
  highlight,
  text,
  pixelate,
]) satisfies z.ZodType<Annotation>;
