"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { centreOn, fit } from "@/geom/camera";
import type { Camera } from "@/geom/matrix";
import { cn } from "@/lib/utils";
import { drawImageLayer } from "@/render/image";
import { drawMark } from "@/render/overlay";
import { SAMPLE } from "@/model/sample";
import type { Size } from "@/model/types";
import { createView, type View, type ViewSize } from "@/render/view";

const PIXEL = SAMPLE.pixel;

/**
 * One window onto the sample, drawn by the same view and camera code as the editor, with the
 * signature pixel marked on the overlay.
 */
const Lens = ({
  bitmap,
  camera,
  onScale,
  className,
  children,
}: {
  bitmap: ImageBitmap | null;
  camera: (size: ViewSize) => Camera;
  onScale?: (scale: number) => void;
  className?: string;
  children: ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef(bitmap);
  const viewRef = useRef<View | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!container || !base || !overlay) return;
    let scale: number | null = null;
    const view = createView({
      container,
      base,
      overlay,
      camera,
      drawBase: (ctx, frame) => {
        if (bitmapRef.current) drawImageLayer(ctx, frame, bitmapRef.current);
      },
      drawOverlay: (ctx, frame) => drawMark(ctx, frame, PIXEL),
      onFrame: ({ camera: { scale: next } }) => {
        if (next === scale) return;
        scale = next;
        onScale?.(next);
      },
    });
    viewRef.current = view;
    return () => view.dispose();
  }, [camera, onScale]);

  useEffect(() => {
    bitmapRef.current = bitmap;
    viewRef.current?.invalidate("base");
  }, [bitmap]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-paper-3 outline -outline-offset-1 outline-foreground/10",
        className,
      )}
    >
      <div ref={containerRef} aria-hidden className="absolute inset-0">
        <canvas ref={baseRef} className="absolute top-0 left-0" />
        <canvas ref={overlayRef} className="absolute top-0 left-0" />
      </div>
      {children}
    </div>
  );
};

const Strip = ({ items }: { items: [string, string][] }) => (
  <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap gap-x-10 gap-y-1 bg-background/80 px-4 py-2">
    {items.map(([key, value]) => (
      <p key={key} className="grid">
        <span className="text-xs leading-[1.4] font-medium text-ink-2">
          {key}
        </span>
        <span className="font-mono text-sm leading-[1.4] text-foreground tabular-nums">
          {value}
        </span>
      </p>
    ))}
  </div>
);

const at = `${PIXEL.x}, ${PIXEL.y}`;
// Stable per size, so the lenses aren't rebuilt on every render.
const lensCameras = (nat: Size) => ({
  whole: (view: ViewSize) => fit(nat, { w: view.cssW, h: view.cssH }, 1),
  at400: (view: ViewSize) => centreOn(PIXEL, 4, { w: view.cssW, h: view.cssH }),
  at100: (view: ViewSize) => centreOn(PIXEL, 1, { w: view.cssW, h: view.cssH }),
});

/**
 * The open screen's figure: one pixel of the sample photo, the corner of the "14" on a rowboat,
 * read at the fitted zoom, at 400% and at 1:1 (the pixels a PNG holds), the same image pixel each
 * time.
 */
export const Hero = ({
  image,
  onOpenSample,
}: {
  image: { bitmap: ImageBitmap; natural: Size } | null;
  onOpenSample: () => void;
}) => {
  const [fitted, setFitted] = useState<number | null>(null);
  // The sample's known size until it decodes, so the figure keeps its shape while it loads.
  const natural = image?.natural ?? SAMPLE.size;
  const { w, h } = natural;
  const cameras = useMemo(() => lensCameras({ w, h }), [w, h]);
  const bitmap = image?.bitmap ?? null;
  const size = `${w} × ${h}`;
  return (
    <figure className="m-0 grid h-[min(calc(100dvh-56px-32px),850px)] grid-rows-[auto_minmax(140px,1fr)] gap-2 max-[60rem]:h-auto max-[60rem]:grid-rows-[auto_200px]">
      <button
        type="button"
        onClick={onOpenSample}
        aria-label={`Open the sample photo, ${SAMPLE.name}, at the corner of boat 14’s number, pixel ${at}`}
        style={{ aspectRatio: `${w} / ${h}` }}
        className="relative block cursor-pointer before:pointer-events-none before:absolute before:-top-2 before:-left-2 before:z-10 before:size-3 before:border-t before:border-l before:border-muted-foreground after:pointer-events-none after:absolute after:-right-2 after:-bottom-2 after:z-10 after:size-3 after:border-r after:border-b after:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Lens
          bitmap={bitmap}
          camera={cameras.whole}
          onScale={setFitted}
          className="absolute inset-0"
        >
          <Strip
            items={[
              [
                "View",
                `${fitted === null ? "–" : Math.round(fitted * 100)}% · ${size}`,
              ],
              ["Pixel", at],
            ]}
          />
        </Lens>
      </button>
      <div className="grid min-h-0 grid-cols-2 gap-2 max-[40rem]:grid-cols-1">
        <Lens bitmap={bitmap} camera={cameras.at400}>
          <Strip
            items={[
              ["Zoomed", "400%"],
              ["Pixel", at],
            ]}
          />
        </Lens>
        <Lens bitmap={bitmap} camera={cameras.at100}>
          <Strip
            items={[
              ["The PNG", size],
              ["Pixel", at],
            ]}
          />
        </Lens>
      </div>
      <figcaption className="sr-only">
        The corner of boat 14’s number in the sample photo at the fitted zoom,
        at 400% and at 1:1: image pixel {at} each time.
      </figcaption>
    </figure>
  );
};
