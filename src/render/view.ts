/**
 * The view: two stacked canvases, `base` and `overlay`, sized to their container at the display's
 * pixel density and redrawn through one render loop.
 *
 * This is the only module that knows about device pixels. It is the only reader of
 * `window.devicePixelRatio`, it builds the device matrix, and it holds the only call that sets a
 * canvas transform (ARCHITECTURE.md §4). The base layer is drawn in image px through the camera;
 * the overlay is drawn in screen px, for affordances that keep their size at any zoom.
 */

import { M, type Camera } from "@/geom/matrix";
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
  camera: Camera;
  /** The backing store of both canvases, in device px. */
  backing: { width: number; height: number };
  /** Animation frames drawn so far. */
  frames: number;
  baseDraws: number;
  overlayDraws: number;
}

export interface Frame {
  size: ViewSize;
  /** The camera this frame was drawn with; pointer events must be read through the same one. */
  camera: Camera;
}

export type DrawLayer = (ctx: CanvasRenderingContext2D, frame: Frame) => void;

export interface ViewOptions {
  /** The element the canvases fill. Its size drives theirs, never the reverse. */
  container: HTMLElement;
  base: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  /** The camera for a view of this size. Read once per frame. */
  camera: (size: ViewSize) => Camera;
  /** Draws in image px: the context already carries the camera and the pixel ratio. */
  drawBase: DrawLayer;
  /** Draws in screen px: handles, guides and anything else sized in CSS px. */
  drawOverlay: DrawLayer;
  /** Called after every frame. */
  onFrame?: (stats: ViewStats) => void;
}

const readDpr = () => window.devicePixelRatio || 1;

/** Backing-store size, in device px, for a canvas shown at `cssW × cssH` CSS px. */
const backingSize = ({ cssW, cssH, dpr }: ViewSize) => ({
  width: Math.round(cssW * dpr),
  height: Math.round(cssH * dpr),
});

/**
 * Size one canvas: the backing store in device px, the element in CSS px, on both axes. Returns
 * whether the backing store changed, which clears the canvas and resets its context.
 */
const sizeCanvas = (canvas: HTMLCanvasElement, size: ViewSize) => {
  const { width, height } = backingSize(size);
  canvas.style.width = `${size.cssW}px`;
  canvas.style.height = `${size.cssH}px`;
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
};

/** The overlay's camera: screen px are its own units. */
const SCREEN: Camera = { scale: 1, tx: 0, ty: 0 };
const IDENTITY: DOMMatrix2DInit = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/**
 * Device px per image px: `M`, then the pixel ratio. Painting uses this; pointer events never do,
 * because their coordinates are already CSS px. Using it for both puts every click at twice the
 * distance from the origin on a Retina screen.
 */
export const deviceMatrix = (camera: Camera, dpr: number) =>
  new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).multiplySelf(M(camera));

/** The one place a canvas transform is set. */
const setMatrix = (ctx: CanvasRenderingContext2D, matrix: DOMMatrix2DInit) =>
  ctx.setTransform(matrix);

/** Clear a layer in device px, then point it at the matrix it is drawn through. */
const beginLayer = (ctx: CanvasRenderingContext2D, matrix: DOMMatrix2DInit) => {
  setMatrix(ctx, IDENTITY);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  setMatrix(ctx, matrix);
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
  camera: cameraFor,
  drawBase,
  drawOverlay,
  onFrame,
}: ViewOptions) => {
  const baseCtx = base.getContext("2d");
  const overlayCtx = overlay.getContext("2d");
  if (!baseCtx || !overlayCtx)
    throw new Error("This browser has no 2D canvas.");

  let size: ViewSize = { cssW: 0, cssH: 0, dpr: readDpr() };
  let camera = cameraFor(size);
  let baseDraws = 0;
  let overlayDraws = 0;

  const loop = createRenderLoop<Layer>((dirty) => {
    camera = cameraFor(size);
    const frame: Frame = { size, camera };
    if (dirty.has("base")) {
      beginLayer(baseCtx, deviceMatrix(camera, size.dpr));
      drawBase(baseCtx, frame);
      baseDraws += 1;
    }
    if (dirty.has("overlay")) {
      beginLayer(overlayCtx, deviceMatrix(SCREEN, size.dpr));
      drawOverlay(overlayCtx, frame);
      overlayDraws += 1;
    }
    onFrame?.({
      size,
      camera,
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
    /** The camera of the latest frame, for reading pointer events with `toImage`. */
    camera: () => camera,
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
