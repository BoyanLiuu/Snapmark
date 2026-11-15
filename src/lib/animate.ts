/** Motion is an accent here, never information: with this on, every beat is skipped to its end. */
export const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Runs `step` on each frame with the milliseconds elapsed, then once with `duration`, and stops.
 * With reduced motion it runs the last frame only. Returns a function that stops it early.
 */
export const animate = (duration: number, step: (elapsed: number) => void) => {
  if (reducedMotion()) {
    step(duration);
    return () => {};
  }
  let frame = 0;
  let start: number | null = null;
  const tick = (now: number) => {
    start ??= now;
    const elapsed = now - start;
    if (elapsed >= duration) {
      step(duration);
      return;
    }
    step(elapsed);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
};

/** Fast, then settling: a hand moving to where it means to go. */
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Where `elapsed` sits in a beat that runs `from` to `to` ms: 0 before, 1 after, eased between. */
export const beat = (
  elapsed: number,
  [from, to]: readonly [number, number],
  ease = easeOut,
) => ease(Math.min(1, Math.max(0, (elapsed - from) / (to - from))));

/** Straight through, for typing and for a pointer at a steady pace. */
export const linear = (t: number) => t;
