"use client";

import { Eye, EyeOff, GripVertical } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Id } from "@/model/types";
import type { LayerRow } from "./layers";
import { KIND_ICON } from "./tools";

const plural = (n: number) => `${n} annotation${n === 1 ? "" : "s"}`;

/**
 * The layers rail: one row per annotation, top of the paint order first, with its size in image
 * px. The eye button hides a layer from the canvas; selection is UI state until M5.
 */
export const LayerList = ({
  layers,
  hidden,
  onToggleHidden,
}: {
  layers: LayerRow[];
  hidden: ReadonlySet<Id>;
  onToggleHidden: (id: Id) => void;
}) => {
  const [selected, setSelected] = useState<Id | null>(null);

  return (
    <section aria-labelledby="layers-title" className="grid gap-4 border-b p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="layers-title"
          className="text-[1.2rem] leading-[1.05] font-medium tracking-[-0.04em]"
        >
          Layers
        </h2>
        <p className="text-sm text-muted-foreground">{plural(layers.length)}</p>
      </div>

      {layers.length === 0 && (
        <p className="py-6 text-sm text-ink-2">
          Each box, arrow and label gets a row here, top first.
        </p>
      )}
      <ol className="-mx-3">
        {layers.map(({ id, kind, name, dims }) => {
          const Icon = KIND_ICON[kind];
          const isSelected = selected === id;
          const isHidden = hidden.has(id);
          return (
            <li
              key={id}
              data-selected={isSelected || undefined}
              className={cn(
                "relative grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-1 border-b border-rule-2 pl-1",
                isSelected &&
                  "bg-paper-3 before:absolute before:top-1/2 before:-left-px before:size-1.5 before:-translate-y-1/2 before:bg-primary",
              )}
            >
              <span
                aria-hidden
                title="Reordering arrives in M15"
                className="grid cursor-grab place-items-center text-muted-2"
              >
                <GripVertical className="size-4 [stroke-width:2.5]" />
              </span>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelected(isSelected ? null : id)}
                className={cn(
                  "grid min-h-10 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 px-2 text-left text-sm whitespace-nowrap text-ink-2 outline-none hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  isSelected && "text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span
                  className={cn(
                    "truncate",
                    isHidden &&
                      "text-muted-foreground line-through decoration-muted-2",
                  )}
                >
                  {name}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {dims}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-control"
                className="size-8 [&_svg:not([class*='size-'])]:size-4"
                aria-pressed={!isHidden}
                aria-label={`${isHidden ? "Show" : "Hide"} ${name}`}
                onClick={() => onToggleHidden(id)}
              >
                {isHidden ? <EyeOff /> : <Eye />}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
