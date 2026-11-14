"use client";

import { Minus, Plus, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TOOLS, type ToolId } from "./tools";

const nbsp = (s: string) => s.replaceAll(" ", "\u00a0");

export interface EditorBarProps {
  fileName: string;
  /** Natural size in image px; null while a file decodes and its size isn't known yet. */
  natural: { w: number; h: number } | null;
  /** Screen px per image px (1 = one image pixel per CSS pixel); null until the first frame. */
  zoom: number | null;
  tool: ToolId;
  onToolChange: (tool: ToolId) => void;
  /** What undo and redo would step over; null when there is nothing to step. */
  undoLabel: string | null;
  redoLabel: string | null;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * The annotator's own toolbar: the file and its natural size, the six tools, undo and redo, the
 * zoom group, then Export and Copy. Copy is the primary action; do not invert this later.
 */
export const EditorBar = ({
  fileName,
  natural,
  zoom,
  tool,
  onToolChange,
  undoLabel,
  redoLabel,
  onUndo,
  onRedo,
}: EditorBarProps) => {
  const size = natural ? `${natural.w} × ${natural.h}` : "";
  return (
    <div
      data-testid="editor-bar"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-background px-4 py-2"
    >
      <div className="grid max-w-72 min-w-0">
        <h1
          id="editor-file"
          className="truncate text-base leading-[1.3] font-medium tracking-[-0.01em]"
        >
          {fileName}
        </h1>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {natural ? nbsp(`${size} px`) : "Decoding…"}
        </span>
      </div>

      <ToggleGroup
        type="single"
        aria-label="Tool"
        spacing={0.5}
        value={tool}
        // A single-choice group: clicking the current tool keeps it rather than clearing it.
        onValueChange={(value) => value && onToolChange(value as ToolId)}
      >
        {TOOLS.map(({ id, label, shortcut, icon: Icon, from }) => (
          <ToggleGroupItem
            key={id}
            value={id}
            aria-label={label}
            title={
              from
                ? `${label} (${shortcut}) · draws from ${from}`
                : `${label} (${shortcut})`
            }
            className="relative size-9 min-w-9 px-0 text-ink-2 hover:bg-card hover:text-foreground data-[state=on]:bg-paper-3 data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_var(--border)] data-[state=on]:after:absolute data-[state=on]:after:top-[3px] data-[state=on]:after:right-[3px] data-[state=on]:after:size-[5px] data-[state=on]:after:bg-primary"
          >
            <Icon className="size-5" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-control"
          aria-label="Undo"
          title={
            undoLabel
              ? `Undo ${undoLabel.toLowerCase()} (⌘Z)`
              : "Nothing to undo"
          }
          disabled={!undoLabel}
          onClick={onUndo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-control"
          aria-label="Redo"
          title={
            redoLabel
              ? `Redo ${redoLabel.toLowerCase()} (⇧⌘Z)`
              : "Nothing to redo"
          }
          disabled={!redoLabel}
          onClick={onRedo}
        >
          <Redo2 />
        </Button>
      </div>

      <div
        role="group"
        aria-label="Zoom"
        className="ml-auto flex items-center gap-0.5"
      >
        <Button
          variant="ghost"
          size="icon-control"
          aria-label="Zoom out"
          title="Zoom arrives in M11"
        >
          <Minus />
        </Button>
        <output className="min-w-[15ch] px-2 text-center font-mono text-sm whitespace-nowrap text-ink-2 tabular-nums">
          {nbsp(
            zoom === null ? size : `${Math.round(zoom * 100)}% · ${size}`,
          ) || "–"}
        </output>
        <Button
          variant="ghost"
          size="icon-control"
          aria-label="Zoom in"
          title="Zoom arrives in M11"
        >
          <Plus />
        </Button>
        <Button
          variant="outline"
          size="control"
          className="min-w-11 px-3"
          title="Fit (⇧1) · arrives in M11"
        >
          Fit
        </Button>
        <Button
          variant="outline"
          size="control"
          className="min-w-11 px-3"
          title="One image pixel per screen pixel (⇧0) · arrives in M11"
        >
          1:1
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="control" title="Export arrives in M8">
          Export
        </Button>
        <Button
          size="control"
          className="min-w-[8.5rem]"
          title="Copy the PNG (⌘C) · arrives in M8"
        >
          Copy
        </Button>
      </div>
    </div>
  );
};
