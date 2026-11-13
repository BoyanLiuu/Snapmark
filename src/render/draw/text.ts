/** Text on a dark plate, so it reads on any photo (ARCHITECTURE.md §8). Laid out by text-layout.ts. */

import { swatch } from "@/model/palette";
import type { TextA } from "@/model/types";
import { fontFor, layoutText, PLATE_PAD } from "../text-layout";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const PLATE = "oklch(9% 0.008 75 / 0.74)";

export const drawText = (ctx: Ctx, a: TextA) => {
  const { lines, widest, lineHeight } = layoutText(a);
  ctx.font = fontFor(a);
  ctx.globalAlpha = a.opacity;
  if (a.plate) {
    const pad = a.fontSize * PLATE_PAD;
    ctx.fillStyle = PLATE;
    ctx.fillRect(
      a.x - pad,
      a.y - pad,
      widest + 2 * pad,
      lines.length * lineHeight + 2 * pad,
    );
  }
  ctx.fillStyle = swatch(a.color).css;
  ctx.textBaseline = "middle";
  lines.forEach((line, i) =>
    ctx.fillText(line, a.x, a.y + (i + 0.5) * lineHeight),
  );
};
