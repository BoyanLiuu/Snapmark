/**
 * The view: two stacked canvases, `base` and `overlay`, sized to their container at the display's
 * pixel density and redrawn through one render loop.
 *
 * This is the only module that knows about device pixels. It is the only reader of
 * `window.devicePixelRatio` and holds the only call that sets a canvas transform
 * (ARCHITECTURE.md §4). Draw callbacks work in CSS px; from M2 the base layer works in image px.
 */

import { createRenderLoop } from "./loop";

export type Layer = "base" | "overlay";

export interface ViewSize {
  /** Canvas size in CSS px. */
  cssW: number;
  cssH: number;
  /** Device pixels per CSS pixel on the display the canvas is on. */
  dpr: number;
}

export interface ViewStats {
  size: ViewSize;
  /** The backing store of both canvases, in device px. */
  backing: { width: number; height: number };
  /** Animation frames drawn so far. */
  frames: number;
  baseDraws: number;
  overlayDraws: number;
}

export type DrawLayer = (ctx: CanvasRenderingContext2D, size: ViewSize) => void;

export interface ViewOptions {
  /** The element the canvases fill. Its size drives theirs, never the reverse. */
  container: HTMLElement;
  base: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  drawBase: DrawLayer;
  drawOverlay: DrawLayer;
  /** Called after every frame. */
  onFrame?: (stats: ViewStats) => void;
}

const readDpr = () => window.devicePixelRatio || 1;

/** Backing-store size, in device px, for a canvas shown at `cssW × cssH` CSS px. */
export const backingSize = ({ cssW, cssH, dpr }: ViewSize) => ({
  width: Math.round(cssW * dpr),
  height: Math.round(cssH * dpr),
});

/**
 * Size one canvas: the backing store in device px, the element in CSS px, on both axes. Returns
 * whether the backing store changed, which clears the canvas and resets its context.
 */
export const sizeCanvas = (canvas: HTMLCanvasElement, size: ViewSize) => {
  const { width, height } = backingSize(size);
  canvas.style.width = `${size.cssW}px`;
  canvas.style.height = `${size.cssH}px`;
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
};

/** Point a context at CSS px and clear it. Every layer starts its frame here. */
const beginLayer = (ctx: CanvasRenderingContext2D, { dpr }: ViewSize) => {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Cleared in CSS px by the backing store's own dimensions, which over-cover it: the backing
  // size was rounded, so `cssW × cssH` can fall half a device pixel short.
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};

/**
 * Call `onChange` whenever the device pixel ratio changes: the window moved to a display with a
 * different density, or the page was zoomed. A `resolution` query only matches one value, so it
 * is re-armed after each change.
 */
const watchDpr = (onChange: () => void) => {
  let query: MediaQueryList | null = null;
  const handle = () => {
    arm();
    onChange();
  };
  const arm = () => {
    query?.removeEventListener("change", handle);
    query = window.matchMedia(`(resolution: ${readDpr()}dppx)`);
    query.addEventListener("change", handle);
  };
  arm();
  return () => query?.removeEventListener("change", handle);
};

export const createView = ({
  container,
  base,
  overlay,
  drawBase,
  drawOverlay,
  onFrame,
}: ViewOptions) => {
  const baseCtx = base.getContext("2d");
  const overlayCtx = overlay.getContext("2d");
  if (!baseCtx || !overlayCtx)
    throw new Error("This browser has no 2D canvas.");

  let size: ViewSize = { cssW: 0, cssH: 0, dpr: readDpr() };
  let baseDraws = 0;
  let overlayDraws = 0;

  const loop = createRenderLoop<Layer>((dirty) => {
    if (dirty.has("base")) {
      beginLayer(baseCtx, size);
      drawBase(baseCtx, size);
      baseDraws += 1;
    }
    if (dirty.has("overlay")) {
      beginLayer(overlayCtx, size);
      drawOverlay(overlayCtx, size);
      overlayDraws += 1;
    }
    onFrame?.({
      size,
      backing: { width: base.width, height: base.height },
      frames: loop.frames,
      baseDraws,
      overlayDraws,
    });
  });

  const resize = (cssW: number, cssH: number) => {
    size = { cssW, cssH, dpr: readDpr() };
    const baseChanged = sizeCanvas(base, size);
    const overlayChanged = sizeCanvas(overlay, size);
    if (!baseChanged && !overlayChanged && loop.frames > 0) return;
    // Resizing cleared both canvases: redraw now rather than next frame, so dragging the window
    // edge never shows a blank canvas.
    loop.invalidate("base", "overlay");
    loop.flush();
  };

  // Whole CSS px, so at a whole-number DPR the backing store is exactly `cssW × dpr`.
  const observer = new ResizeObserver(([entry]) => {
    if (entry)
      resize(
        Math.floor(entry.contentRect.width),
        Math.floor(entry.contentRect.height),
      );
  });
  observer.observe(container);
  const unwatchDpr = watchDpr(() => resize(size.cssW, size.cssH));

  return {
    /** Redraw the given layers on the next frame; both when none are given. */
    invalidate: (...layers: Layer[]) =>
      loop.invalidate(
        ...(layers.length > 0 ? layers : (["base", "overlay"] as const)),
      ),
    dispose: () => {
      observer.disconnect();
      unwatchDpr();
      loop.dispose();
    },
  };
};

export type View = ReturnType<typeof createView>;
