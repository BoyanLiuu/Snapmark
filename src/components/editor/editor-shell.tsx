"use client";

import { useState } from "react";
import { AppBar } from "./app-bar";
import { CanvasStage } from "./canvas-stage";
import { EditorBar } from "./editor-bar";
import { Inspector } from "./inspector";
import { LayerList } from "./layer-list";
import { SAMPLE_IMAGE, SAMPLE_LAYERS, SAMPLE_STATUS } from "./sample";
import type { ToolId } from "./tools";

/**
 * Screen 09, laid out (M1): app bar, editor bar, the stage with its status strip, and the rail
 * with the inspector above the layers. The controls hold UI state only; nothing reaches the canvas.
 */
export const EditorShell = () => {
  const [tool, setTool] = useState<ToolId>("select");
  const image = SAMPLE_IMAGE;

  return (
    <div className="flex h-dvh min-h-[560px] flex-col">
      <p className="shrink-0 border-b bg-card px-4 py-2 text-sm text-muted-foreground">
        Layout only. The filename, zoom and layers are the design file’s sample
        data, and nothing is wired to the canvas yet.
      </p>
      <AppBar />
      <main
        aria-labelledby="editor-file"
        className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]"
      >
        <EditorBar
          fileName={image.name}
          naturalWidth={image.naturalWidth}
          naturalHeight={image.naturalHeight}
          zoom={image.zoom}
          tool={tool}
          onToolChange={setTool}
        />
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px]">
          <CanvasStage status={SAMPLE_STATUS} />
          <aside
            aria-label="Inspector and layers"
            className="flex min-h-0 flex-col overflow-y-auto border-l bg-card"
          >
            <Inspector naturalWidth={image.naturalWidth} />
            <LayerList layers={SAMPLE_LAYERS} />
            <p className="mt-auto px-6 py-4 text-sm text-muted-foreground">
              Drag a row, or press{" "}
              <kbd className="inline-block min-w-[1.6em] border px-1 text-center font-mono text-[0.85em] leading-normal text-ink-2">
                ⌥ ↑
              </kbd>
              , to change what sits on top.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
};
