import {
  ArrowUpRight,
  Grid3x3,
  Highlighter,
  MousePointer2,
  Square,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { LayerKind } from "./sample";

export type ToolId =
  "select" | "rect" | "arrow" | "highlight" | "text" | "pixelate";

export interface Tool {
  id: ToolId;
  label: string;
  /** The single-key shortcut (wired in M18). */
  shortcut: string;
  icon: LucideIcon;
  /** The milestone in which the tool starts to draw. */
  from: string;
}

/** The six tools, in the design file's order. */
export const TOOLS: Tool[] = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    icon: MousePointer2,
    from: "M5",
  },
  { id: "rect", label: "Rectangle", shortcut: "R", icon: Square, from: "M5" },
  {
    id: "arrow",
    label: "Arrow",
    shortcut: "A",
    icon: ArrowUpRight,
    from: "M7",
  },
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

export const KIND_ICON: Record<LayerKind, LucideIcon> = {
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
