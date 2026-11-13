import { describe, expect, it, vi } from "vitest";
import { createRenderLoop, type FrameScheduler } from "./loop";

/**
 * The loop's ordering rules, which the browser checks can't isolate. That an idle page draws
 * nothing is checked in the browser (e2e/canvas.spec.ts), where it also proves nothing else in
 * the app keeps invalidating.
 */

/** A frame scheduler the test advances by hand. */
const manualFrames = () => {
  const queue = new Map<number, () => void>();
  let next = 1;
  const scheduler: FrameScheduler = {
    request: (callback) => {
      queue.set(next, callback);
      return next++;
    },
    cancel: (handle) => {
      queue.delete(handle);
    },
  };
  const advance = () => {
    const callbacks = [...queue.values()];
    queue.clear();
    for (const callback of callbacks) callback();
  };
  return {
    scheduler,
    advance,
    get scheduled() {
      return queue.size;
    },
  };
};

describe("createRenderLoop", () => {
  it("draws every layer invalidated within a frame in one frame", () => {
    const frames = manualFrames();
    const render = vi.fn();
    const loop = createRenderLoop<"base" | "overlay">(render, frames.scheduler);
    loop.invalidate("overlay");
    loop.invalidate("overlay");
    loop.invalidate("base");
    expect(frames.scheduled).toBe(1);
    frames.advance();
    expect(render).toHaveBeenCalledTimes(1);
    expect([...render.mock.calls[0][0]].sort()).toEqual(["base", "overlay"]);
  });

  it("keeps an invalidation made during a render for the next frame", () => {
    // The dirty set is cleared before rendering; clearing it after would drop this.
    const frames = manualFrames();
    let again = true;
    const loop = createRenderLoop<"overlay">(() => {
      if (again) loop.invalidate("overlay");
      again = false;
    }, frames.scheduler);
    loop.invalidate("overlay");
    frames.advance();
    frames.advance();
    frames.advance();
    expect(loop.frames).toBe(2);
  });

  it("flush draws now, not next frame, so a resize never shows a blank canvas", () => {
    const frames = manualFrames();
    const render = vi.fn();
    const loop = createRenderLoop(render, frames.scheduler);
    loop.invalidate("base");
    loop.flush();
    expect(render).toHaveBeenCalledTimes(1);
    frames.advance();
    expect(render).toHaveBeenCalledTimes(1);
  });
});
