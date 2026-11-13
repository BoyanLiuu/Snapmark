"use client";

import { RefreshCw } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { drawDemoBase, drawDemoOverlay, type Point } from "@/render/demo";
import { createView, type View, type ViewStats } from "@/render/view";

const noSubscribe = () => () => {};

/** `?debug` in the address shows the render loop's readout from M0 in the status strip. */
const useDebug = () =>
  useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );

const RenderReadout = ({
  stats,
  onRedrawBase,
}: {
  stats: ViewStats | null;
  onRedrawBase: () => void;
}) => {
  if (!stats) return <span>Sizing the canvas…</span>;
  const { backing, size } = stats;
  const matches =
    backing.width === Math.round(size.cssW * size.dpr) &&
    backing.height === Math.round(size.cssH * size.dpr);
  return (
    <span className="ml-auto flex items-center gap-4 font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
      <span>
        <span className="text-foreground">
          {backing.width} × {backing.height}
        </span>{" "}
        = {size.cssW} × {size.cssH} × {size.dpr}
        <span className={matches ? "text-success" : "text-destructive"}>
          {matches ? " ✓" : " ✗"}
        </span>
      </span>
      <span>frames {stats.frames}</span>
      <span>base {stats.baseDraws}</span>
      <span>overlay {stats.overlayDraws}</span>
      <Button variant="outline" size="xs" onClick={onRedrawBase}>
        <RefreshCw data-icon="inline-start" />
        Redraw base
      </Button>
    </span>
  );
};

/**
 * The stage: the `base` and `overlay` canvases stacked in a container whose size the layout sets,
 * over the status strip (cursor readout and status line).
 */
export const CanvasStage = ({ status }: { status: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);
  // Read by the overlay draw; kept out of React state so moving the pointer re-renders nothing.
  const pointerRef = useRef<Point | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<ViewStats | null>(null);
  const debug = useDebug();
  const debugRef = useRef(debug);

  useEffect(() => {
    const container = containerRef.current;
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!container || !base || !overlay) return;
    const view = createView({
      container,
      base,
      overlay,
      drawBase: drawDemoBase,
      drawOverlay: (ctx, size) =>
        drawDemoOverlay(ctx, size, pointerRef.current),
      // Frames happen on every pointer move, so React only hears about them when the debug
      // readout is showing. The counters for the browser checks go straight onto the strip.
      onFrame: (next) => {
        const strip = stripRef.current;
        if (strip) {
          strip.dataset.frames = String(next.frames);
          strip.dataset.baseDraws = String(next.baseDraws);
          strip.dataset.overlayDraws = String(next.overlayDraws);
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
    debugRef.current = debug;
    // Draw one frame so the readout has numbers as soon as it appears.
    if (debug) viewRef.current?.invalidate("overlay");
  }, [debug]);

  const trackPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    viewRef.current?.invalidate("overlay");
  };

  const clearPointer = () => {
    pointerRef.current = null;
    viewRef.current?.invalidate("overlay");
  };

  return (
    <div className="relative grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-paper-3">
      <div ref={containerRef} className="relative min-h-0 overflow-hidden">
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
        ref={stripRef}
        data-testid="render-stats"
        className="relative flex min-h-[41px] items-center gap-6 overflow-hidden border-t bg-background px-4 py-1 text-sm"
      >
        {/* The image pixel under the pointer, from M2 (open question 3). */}
        <p
          aria-hidden
          className="min-w-[15ch] font-mono whitespace-nowrap text-muted-foreground"
        >
          Pointer off
        </p>
        <p role="status" className="min-w-0 truncate text-ink-2">
          {status}
        </p>
        {debug && (
          <RenderReadout
            stats={stats}
            onRedrawBase={() => viewRef.current?.invalidate("base")}
          />
        )}
      </div>
    </div>
  );
};
