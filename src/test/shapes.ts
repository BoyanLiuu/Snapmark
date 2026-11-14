import type { Box } from "@/model/bbox";
import type { ArrowA, RectA } from "@/model/types";

export const LOOK = { color: "red", strokeWidth: 4, opacity: 1 } as const;

type Style = Partial<Pick<RectA, "color" | "strokeWidth" | "opacity">>;

export const rect = (id: string, box: Box, style: Style = {}): RectA => ({
  id,
  kind: "rect",
  ...LOOK,
  ...style,
  ...box,
});

export const arrow = (
  id: string,
  ends: Pick<ArrowA, "x1" | "y1" | "x2" | "y2">,
  style: Style = {},
): ArrowA => ({ id, kind: "arrow", ...LOOK, ...style, ...ends });
