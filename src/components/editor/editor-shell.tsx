"use client";

import { useEffect, useState } from "react";
import { CHART_NAME, CHART_SIZE, createTestChart } from "@/render/test-chart";
import { AppBar } from "./app-bar";
import { CanvasStage, type StageImage } from "./canvas-stage";
import { EditorBar } from "./editor-bar";
import { Inspector } from "./inspector";
import { LayerList } from "./layer-list";
import { SAMPLE_LAYERS, SAMPLE_STATUS } from "./sample";
import type { ToolId } from "./tools";

/**
 * Screen 09: app bar, editor bar, the stage with its status strip, and the rail with the
 * inspector above the layers. The stage shows the test chart until M3 opens real images; the
 * controls hold UI state only.
 */
export const EditorShell = () => {
  const [tool, setTool] = useState<ToolId>("select");
  const [image, setImage] = useState<StageImage | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    createTestChart().then((bitmap) => {
      if (live) setImage({ bitmap, natural: CHART_SIZE });
      else bitmap.close();
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="flex h-dvh min-h-[560px] flex-col">
      <p className="shrink-0 border-b bg-card px-4 py-2 text-sm text-muted-foreground">
        A test chart stands in for your image until M3. The layers are the
        design file’s sample data, and no tool draws yet.
      </p>
      <AppBar />
      <main
        aria-labelledby="editor-file"
        className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]"
      >
        <EditorBar
          fileName={CHART_NAME}
          naturalWidth={CHART_SIZE.w}
          naturalHeight={CHART_SIZE.h}
          zoom={zoom}
          tool={tool}
          onToolChange={setTool}
        />
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px]">
          <CanvasStage
            status={SAMPLE_STATUS}
            image={image}
            onZoomChange={setZoom}
          />
          <aside
            aria-label="Inspector and layers"
            className="flex min-h-0 flex-col overflow-y-auto border-l bg-card"
          >
            <Inspector naturalWidth={CHART_SIZE.w} />
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
