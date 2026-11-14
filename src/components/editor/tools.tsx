import {
  ArrowUpRight,
  Grid3x3,
  Highlighter,
  MousePointer2,
  Square,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { ToolId } from "@/interact/machine";
import type { Annotation } from "@/model/types";

export type { ToolId };

export interface Tool {
  id: ToolId;
  label: string;
  /** The single-key shortcut (wired in M18). */
  shortcut: string;
  icon: LucideIcon;
  /** The milestone in which the tool starts to draw; absent once it does. */
  from?: string;
}

/** The six tools, in the design file's order. */
export const TOOLS: Tool[] = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    icon: MousePointer2,
  },
  { id: "rect", label: "Rectangle", shortcut: "R", icon: Square },
  { id: "arrow", label: "Arrow", shortcut: "A", icon: ArrowUpRight },
  {
    id: "highlight",
    label: "Highlight",
    shortcut: "H",
    icon: Highlighter,
    from: "M12",
  },
  { id: "text", label: "Text", shortcut: "T", icon: Type, from: "M13" },
  {
    id: "pixelate",
    label: "Pixelate",
    shortcut: "P",
    icon: Grid3x3,
    from: "M14",
  },
];

export const TOOL_IDS = TOOLS.map((tool) => tool.id);

export const KIND_ICON: Record<Annotation["kind"], LucideIcon> = {
  arrow: ArrowUpRight,
  text: Type,
  rect: Square,
  pixelate: Grid3x3,
  highlight: Highlighter,
};

/** Snapmark's mark: a frame with a crosshair tick on each side and one pixel at the centre. */
export const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M12 1v6M12 17v6M1 12h6M17 12h6"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect x="11" y="11" width="2" height="2" fill="currentColor" />
  </svg>
);
