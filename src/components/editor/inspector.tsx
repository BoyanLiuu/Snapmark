"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { outline } from "@/model/bbox";
import { KIND_LABEL } from "@/model/describe";
import { SWATCHES, type SwatchId } from "@/model/palette";
import type { Annotation } from "@/model/types";

// Tailwind needs whole class names, so each swatch's classes are spelled out here.
const SWATCH_CLASS: Record<SwatchId, string> = {
  red: "bg-swatch-red hover:bg-swatch-red data-[state=on]:bg-swatch-red",
  orange:
    "bg-swatch-orange hover:bg-swatch-orange data-[state=on]:bg-swatch-orange",
  yellow:
    "bg-swatch-yellow hover:bg-swatch-yellow data-[state=on]:bg-swatch-yellow",
  green:
    "bg-swatch-green hover:bg-swatch-green data-[state=on]:bg-swatch-green",
  sky: "bg-swatch-sky hover:bg-swatch-sky data-[state=on]:bg-swatch-sky",
  white:
    "bg-swatch-white hover:bg-swatch-white data-[state=on]:bg-swatch-white",
};

/** ARCHITECTURE.md §3: a stroke that reads the same on any image, in image px. */
export const defaultStroke = (naturalWidth: number) =>
  Math.max(2, Math.round(naturalWidth / 400));

/** Why the default is what it is, with the arithmetic, as the design file shows it. */
const strokeReason = (naturalWidth: number, stroke: number) =>
  Math.round(naturalWidth / 400) >= 2
    ? `${stroke}\u00a0px is this image’s width ÷ 400.`
    : `${stroke}\u00a0px is the thinnest default, used for images under 600\u00a0px wide.`;

const labelClass = "text-sm font-medium text-muted-foreground";

const RangeField = ({
  id,
  label,
  value,
  min,
  max,
  unit,
  help,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  help?: string;
  onChange: (value: number) => void;
}) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
    <span id={`${id}-label`} className={`col-span-full ${labelClass}`}>
      {label}
    </span>
    <Slider
      aria-labelledby={`${id}-label`}
      aria-describedby={help ? `${id}-help` : undefined}
      aria-valuetext={`${value}${unit}`}
      min={min}
      max={max}
      step={1}
      value={[value]}
      onValueChange={([next]) => onChange(next)}
    />
    <output className="min-w-[6ch] text-right font-mono text-sm text-foreground tabular-nums">
      {value}
      {unit}
    </output>
    {help && (
      <p
        id={`${id}-help`}
        className="col-span-full text-sm text-muted-foreground"
      >
        {help}
      </p>
    )}
  </div>
);

/** The look a new annotation is drawn with, and what the inspector edits on a selected one. */
export interface Style {
  color: SwatchId;
  /** Image px. */
  strokeWidth: number;
  /** 0..1 */
  opacity: number;
}

/**
 * The inspector. With nothing selected it sets the look of the next annotation ("New annotations",
 * screen 09); with one selected it edits that one and shows where it is (screen 13). A fixed
 * six-colour palette and no picker.
 */
export const Inspector = ({
  subject,
  style,
  onChange,
  onDelete,
}: {
  subject: { naturalWidth: number } | { selected: Annotation };
  style: Style;
  onChange: (patch: Partial<Style>) => void;
  onDelete: () => void;
}) => {
  const selected = "selected" in subject ? subject.selected : null;
  const kind = selected?.kind;
  const hasColour = kind !== "pixelate";
  const hasStroke = !kind || kind === "rect" || kind === "arrow";
  const box = selected ? outline(selected) : null;

  return (
    <section
      aria-labelledby="inspector-title"
      className="grid gap-4 border-b p-6"
    >
      <h2
        id="inspector-title"
        className="text-[1.2rem] leading-[1.05] font-medium tracking-[-0.04em]"
      >
        {kind ? KIND_LABEL[kind] : "New annotations"}
      </h2>

      {hasColour && (
        <div className="grid gap-2">
          <span id="colour-label" className={labelClass}>
            Colour
          </span>
          <ToggleGroup
            type="single"
            aria-labelledby="colour-label"
            spacing={2}
            value={style.color}
            onValueChange={(value) =>
              value && onChange({ color: value as SwatchId })
            }
            className="flex-wrap"
          >
            {SWATCHES.map(({ id, label }) => (
              <ToggleGroupItem
                key={id}
                value={id}
                aria-label={label}
                className={`size-8 min-w-8 p-0 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--background)_30%,transparent)] transition-transform hover:-translate-y-px data-[state=on]:outline-2 data-[state=on]:outline-offset-3 data-[state=on]:outline-primary data-[state=on]:outline-solid ${SWATCH_CLASS[id]}`}
              />
            ))}
          </ToggleGroup>
        </div>
      )}

      {hasStroke && (
        <RangeField
          id="stroke"
          label="Stroke"
          value={Math.round(style.strokeWidth)}
          min={1}
          max={60}
          unit={"\u00a0px"}
          help={
            "naturalWidth" in subject
              ? `Image pixels, so it exports at this width at any zoom. ${strokeReason(subject.naturalWidth, defaultStroke(subject.naturalWidth))}`
              : undefined
          }
          onChange={(strokeWidth) => onChange({ strokeWidth })}
        />
      )}
      <RangeField
        id="opacity"
        label="Opacity"
        value={Math.round(style.opacity * 100)}
        min={10}
        max={100}
        unit="%"
        onChange={(percent) => onChange({ opacity: percent / 100 })}
      />

      {box && (
        <>
          <dl className="grid grid-cols-4 border-t border-rule-2 pt-3">
            {(
              [
                ["X", box.x],
                ["Y", box.y],
                ["W", box.w],
                ["H", box.h],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 border-r border-rule-2 px-2 first:pl-0 last:border-r-0"
              >
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd
                  data-testid={`box-${label.toLowerCase()}`}
                  className="font-mono text-sm text-foreground tabular-nums"
                >
                  {Math.round(value)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="control"
              disabled
              title="Z-order arrives in M15"
            >
              <ChevronUp />
              Forward
            </Button>
            <Button
              variant="outline"
              size="control"
              disabled
              title="Z-order arrives in M15"
            >
              <ChevronDown />
              Backward
            </Button>
          </div>
          <div>
            <Button variant="outline" size="control" onClick={onDelete}>
              <Trash2 />
              Delete
            </Button>
          </div>
        </>
      )}
    </section>
  );
};
