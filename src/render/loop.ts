/**
 * The render loop: one requestAnimationFrame callback, driven by a dirty flag per layer rather
 * than a timer. Nothing is scheduled while nothing is dirty, so an idle editor draws no frames.
 */

export interface FrameScheduler {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
}

const animationFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export const createRenderLoop = <Layer extends string>(
  render: (dirty: ReadonlySet<Layer>) => void,
  scheduler: FrameScheduler = animationFrames,
) => {
  const dirty = new Set<Layer>();
  let pending: number | null = null;
  let frames = 0;

  const run = () => {
    if (pending !== null) {
      scheduler.cancel(pending);
      pending = null;
    }
    if (dirty.size === 0) return;
    const layers = new Set(dirty);
    // Cleared before rendering, so a render that invalidates again schedules the next frame.
    dirty.clear();
    frames += 1;
    render(layers);
  };

  const tick = () => {
    pending = null;
    run();
  };

  return {
    /** Mark layers dirty; they are redrawn together on the next animation frame. */
    invalidate(...layers: Layer[]) {
      for (const layer of layers) dirty.add(layer);
      if (pending === null && dirty.size > 0) pending = scheduler.request(tick);
    },
    /** Draw the dirty layers now instead of next frame (after a resize has cleared the canvas). */
    flush: run,
    /** How many frames have been drawn. Stays put while idle. */
    get frames() {
      return frames;
    },
    dispose() {
      if (pending !== null) scheduler.cancel(pending);
      pending = null;
      dirty.clear();
    },
  };
};

export type RenderLoop<Layer extends string> = ReturnType<
  typeof createRenderLoop<Layer>
>;
