"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { fit } from "@/geom/camera";
import { toImage } from "@/geom/matrix";
import { createStore, type Store } from "@/lib/store";
import { useRefValue } from "@/lib/use-ref-value";
import type { LoadedImage } from "@/model/image";
import type { Doc } from "@/model/types";
import type { Point, Size } from "@/model/types";
import { drawImageLayer } from "@/render/image";
import { drawOverlay } from "@/render/overlay";
import { createView, type View, type ViewStats } from "@/render/view";
import { RenderReadout, useDebug } from "./render-readout";

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

const kbd =
  "inline-block min-w-[1.6em] border px-1 text-center font-mono text-[0.85em] leading-normal text-ink-2";

/** Screen 08: the image's frame, dashed, until its pixels arrive. Never an empty stage. */
const DecodingPlate = ({
  name,
  natural,
}: {
  name: string;
  natural: Size | null;
}) => (
  <div
    role="status"
    data-testid="decoding"
    className="absolute inset-0 z-10 grid place-content-center justify-items-center gap-3 p-10 text-center"
  >
    <span
      aria-hidden
      style={{ aspectRatio: natural ? `${natural.w} / ${natural.h}` : "3 / 2" }}
      className="block w-[min(60vw,720px)] max-w-full border border-dashed border-muted-foreground bg-card"
    />
    <p className="font-mono text-sm text-ink-2">
      Decoding {natural ? `${natural.w}\u00a0×\u00a0${natural.h}` : name}
    </p>
  </div>
);

/**
 * Screen 10: nothing drawn yet, and the first step. The pointer passes through everywhere but the
 * button, so the cursor readout still works under it.
 */
const EmptyPlate = ({ onDrawBox }: { onDrawBox: () => void }) => (
  <div
    data-testid="nothing-drawn"
    className="pointer-events-none absolute bottom-10 left-1/2 z-10 grid w-[min(30rem,calc(100%-48px))] -translate-x-1/2 justify-items-center gap-2 border bg-background/80 p-10 text-center"
  >
    <h2 className="text-[1.44rem] leading-[1.05] font-medium tracking-[-0.04em]">
      Nothing drawn on this image yet
    </h2>
    <p className="text-sm text-ink-2">
      Drag across the picture with a tool. Rectangle is{" "}
      <kbd className={kbd}>R</kbd>.
    </p>
    <Button
      size="control"
      className="pointer-events-auto mt-2"
      onClick={onDrawBox}
    >
      Draw a box
    </Button>
  </div>
);

/**
 * The stage: the `base` and `overlay` canvases stacked in a container whose size the layout sets,
 * over the status strip (cursor readout and status line). The image is drawn fitted to the stage,
 * and the pointer is read through the same camera it was drawn with.
 */
export const CanvasStage = ({
  status,
  image,
  doc,
  decoding,
  onDrawBox,
  onZoomChange,
}: {
  status: string;
  /** Null until the image has decoded. */
  image: Pick<LoadedImage, "bitmap" | "natural"> | null;
  /** What is drawn on the image, in image px; null until it has decoded. */
  doc: Doc | null;
  /** While decoding: the file's name, and its size when known (screen 08). */
  decoding: { name: string; natural: Size | null } | null;
  /** The empty state's first step (screen 10): choose the rectangle. */
  onDrawBox: () => void;
  /** Called when the fitted scale changes (screen px per image px). */
  onZoomChange?: (scale: number) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);
  // Read by the draws; kept out of React state so a frame re-renders nothing.
  const pointerRef = useRef<Point | null>(null);
  const imageRef = useRefValue(image);
  const docRef = useRefValue(doc);
  const onZoomRef = useRefValue(onZoomChange);
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
      drawBase: (ctx, frame) => {
        const current = imageRef.current;
        if (current && docRef.current)
          drawImageLayer(ctx, frame, docRef.current, current.bitmap);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The refs are written after render; invalidating here means the next frame sees the new value.
  useEffect(() => {
    viewRef.current?.invalidate();
  }, [image]);
  useEffect(() => {
    viewRef.current?.invalidate("base");
  }, [doc]);

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
        {decoding && <DecodingPlate {...decoding} />}
        {image && doc && doc.order.length === 0 && (
          <EmptyPlate onDrawBox={onDrawBox} />
        )}
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
