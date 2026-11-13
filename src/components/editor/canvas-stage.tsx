"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import { fit } from "@/geom/camera";
import { toImage } from "@/geom/matrix";
import { createStore, type Store } from "@/lib/store";
import type { Point, Size } from "@/model/types";
import { drawOverlay } from "@/render/overlay";
import { createView, type View, type ViewStats } from "@/render/view";
import { RenderReadout, useDebug } from "./render-readout";

/** What the stage shows: the decoded pixels, and the size the document measures them in. */
export interface StageImage {
  bitmap: ImageBitmap;
  /** Natural size in image px. From M11 the bitmap may be a downscaled copy, so this is separate. */
  natural: Size;
}

const POINTER_OFF = "Pointer off";

/** The image pixel under the pointer, which is the pixel whose square contains it. */
const cursorText = ({ x, y }: Point) =>
  `x\u00a0${Math.floor(x)} y\u00a0${Math.floor(y)}`;

const CursorReadout = ({ store }: { store: Store<string> }) => {
  const text = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <p
      aria-hidden
      data-testid="cursor-readout"
      className="min-w-[15ch] font-mono whitespace-nowrap text-muted-foreground tabular-nums"
    >
      {text}
    </p>
  );
};

/**
 * The stage: the `base` and `overlay` canvases stacked in a container whose size the layout sets,
 * over the status strip (cursor readout and status line). The image is drawn fitted to the stage,
 * and the pointer is read through the same camera it was drawn with.
 */
export const CanvasStage = ({
  status,
  image,
  onZoomChange,
}: {
  status: string;
  /** Null until the image has decoded. */
  image: StageImage | null;
  /** Called when the fitted scale changes (screen px per image px). */
  onZoomChange?: (scale: number) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);
  // Read by the draws; kept out of React state so a frame re-renders nothing.
  const pointerRef = useRef<Point | null>(null);
  const imageRef = useRef(image);
  const onZoomRef = useRef(onZoomChange);
  const [cursor] = useState(() => createStore(POINTER_OFF));
  const [stats, setStats] = useState<ViewStats | null>(null);
  const debug = useDebug();
  const debugRef = useRef(debug);

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
      // Until an image arrives, an identity camera: nothing is drawn through it.
      camera: (size) =>
        imageRef.current
          ? fit(imageRef.current.natural, { w: size.cssW, h: size.cssH })
          : { scale: 1, tx: 0, ty: 0 },
      drawBase: (ctx) => {
        const current = imageRef.current;
        if (!current) return;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(current.bitmap, 0, 0);
      },
      drawOverlay: (ctx, frame) => drawOverlay(ctx, frame, pointerRef.current),
      // Frames happen on every pointer move, so React only hears about them when the debug
      // readout is showing. The counters for the browser checks go straight onto the stage.
      onFrame: (next) => {
        container.dataset.frames = String(next.frames);
        container.dataset.baseDraws = String(next.baseDraws);
        container.dataset.overlayDraws = String(next.overlayDraws);
        if (imageRef.current && next.camera.scale !== scale) {
          scale = next.camera.scale;
          onZoomRef.current?.(scale);
        }
        if (debugRef.current) setStats(next);
      },
    });
    viewRef.current = view;
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    imageRef.current = image;
    viewRef.current?.invalidate();
  }, [image]);

  useEffect(() => {
    onZoomRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    debugRef.current = debug;
    // Draw one frame so the readout has numbers as soon as it appears.
    if (debug) viewRef.current?.invalidate("overlay");
  }, [debug]);

  const trackPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    pointerRef.current = screen;
    const view = viewRef.current;
    if (!view) return;
    if (imageRef.current)
      cursor.set(cursorText(toImage(view.camera(), screen)));
    view.invalidate("overlay");
  };

  const clearPointer = () => {
    pointerRef.current = null;
    cursor.set(POINTER_OFF);
    viewRef.current?.invalidate("overlay");
  };

  return (
    <div className="relative grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-paper-3">
      <div
        ref={containerRef}
        data-testid="stage"
        className="relative min-h-0 overflow-hidden"
      >
        <canvas
          ref={baseRef}
          data-layer="base"
          role="img"
          aria-label="Drawing surface"
          className="pointer-events-none absolute top-0 left-0"
        />
        <canvas
          ref={overlayRef}
          data-layer="overlay"
          aria-hidden
          className="absolute top-0 left-0 touch-none"
          onPointerMove={trackPointer}
          onPointerLeave={clearPointer}
        />
      </div>

      <div
        data-testid="status-strip"
        className="relative flex min-h-[41px] items-center gap-6 overflow-hidden border-t bg-background px-4 py-1 text-sm"
      >
        <CursorReadout store={cursor} />
        <p role="status" className="min-w-0 truncate text-ink-2">
          {status}
        </p>
        {debug && <RenderReadout stats={stats} />}
      </div>
    </div>
  );
};
