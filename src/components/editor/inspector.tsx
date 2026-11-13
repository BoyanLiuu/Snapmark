"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SWATCHES, type SwatchId } from "@/model/palette";

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

/**
 * The inspector for new annotations: a fixed six-colour palette with no picker, then stroke and
 * opacity. UI state only until M7 wires it to the model.
 */
export const Inspector = ({ naturalWidth }: { naturalWidth: number }) => {
  const initialStroke = defaultStroke(naturalWidth);
  const [colour, setColour] = useState<SwatchId>("red");
  const [stroke, setStroke] = useState(initialStroke);
  const [opacity, setOpacity] = useState(100);

  return (
    <section
      aria-labelledby="inspector-title"
      className="grid gap-4 border-b p-6"
    >
      <h2
        id="inspector-title"
        className="text-[1.2rem] leading-[1.05] font-medium tracking-[-0.04em]"
      >
        New annotations
      </h2>

      <div className="grid gap-2">
        <span id="colour-label" className={labelClass}>
          Colour
        </span>
        <ToggleGroup
          type="single"
          aria-labelledby="colour-label"
          spacing={2}
          value={colour}
          onValueChange={(value) => value && setColour(value as SwatchId)}
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

      <RangeField
        id="stroke"
        label="Stroke"
        value={stroke}
        min={1}
        max={60}
        unit={"\u00a0px"}
        help={`Image pixels, so it exports at this width at any zoom. ${strokeReason(naturalWidth, initialStroke)}`}
        onChange={setStroke}
      />
      <RangeField
        id="opacity"
        label="Opacity"
        value={opacity}
        min={10}
        max={100}
        unit="%"
        onChange={setOpacity}
      />
    </section>
  );
};
