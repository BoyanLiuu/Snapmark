import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounced } from "./debounce";

describe("debounced", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once after a burst, with the last value", () => {
    const run = vi.fn();
    const { schedule } = debounced<string>(run, 400);
    schedule("a");
    schedule("b");
    vi.advanceTimersByTime(399);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run.mock.calls).toEqual([["b"]]);
  });

  it("flush runs a waiting value now, and the timer then has nothing to run", () => {
    const run = vi.fn();
    const { schedule, flush } = debounced<string>(run, 400);
    schedule("a");
    flush();
    expect(run.mock.calls).toEqual([["a"]]);
    vi.advanceTimersByTime(400);
    expect(run.mock.calls).toEqual([["a"]]);
  });
});
