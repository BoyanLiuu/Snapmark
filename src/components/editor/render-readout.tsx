"use client";

import { useSyncExternalStore } from "react";
import type { ViewStats } from "@/render/view";

const noSubscribe = () => () => {};

/** `?debug` in the address shows the render loop's readout in the status strip. */
export const useDebug = () =>
  useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );

/**
 * The render loop's numbers, for checks that need a real display: drag the window to a monitor
 * with another pixel ratio and watch the backing store follow.
 */
export const RenderReadout = ({ stats }: { stats: ViewStats | null }) => {
  if (!stats) return <span className="ml-auto">Sizing the canvas…</span>;
  const { backing, size } = stats;
  return (
    <span className="ml-auto flex items-center gap-4 font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
      <span>
        <span className="text-foreground">
          {backing.width} × {backing.height}
        </span>{" "}
        device px = {size.cssW} × {size.cssH} CSS px × {size.dpr}
      </span>
      <span>frames {stats.frames}</span>
      <span>base {stats.baseDraws}</span>
      <span>overlay {stats.overlayDraws}</span>
    </span>
  );
};
