"use client";

import { useMemo, useState } from "react";
import { createDoc, withoutIds } from "@/model/doc";
import { SAMPLE_DOC, SAMPLE_EDITED } from "@/model/sample";
import type { Id } from "@/model/types";
import type { LoadedImage } from "@/model/image";
import { SampleCredit } from "../open/sample-credit";
import { AppBar } from "./app-bar";
import { CanvasStage } from "./canvas-stage";
import { EditorBar } from "./editor-bar";
import { Inspector } from "./inspector";
import { LayerList } from "./layer-list";
import { layerRows } from "./layers";
import type { ToolId } from "./tools";

/**
 * Screen 09: app bar, editor bar, the stage with its status strip, and the rail with the
 * inspector above the layers. The controls hold UI state only; no tool draws yet. The sample
 * (the test chart) shows the design file's sample layers; an image you open starts with none.
 */
export const EditorShell = ({
  image,
  sample,
  onClose,
}: {
  image: LoadedImage;
  sample: boolean;
  onClose: () => void;
}) => {
  const [tool, setTool] = useState<ToolId>("select");
  const [zoom, setZoom] = useState<number | null>(null);
  const [doc] = useState(() =>
    sample ? SAMPLE_DOC : createDoc(image.natural),
  );
  const [hidden, setHidden] = useState<ReadonlySet<Id>>(new Set());
  const shown = useMemo(() => withoutIds(doc, hidden), [doc, hidden]);
  const count = doc.order.length;
  const status = count
    ? `${count} annotation${count === 1 ? "" : "s"}, last edited ${SAMPLE_EDITED}.`
    : "Nothing drawn on this image yet.";

  const toggleHidden = (id: Id) =>
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="flex h-dvh min-h-[560px] flex-col">
      <AppBar variant="app" onHome={onClose} />
      <main
        aria-labelledby="editor-file"
        className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]"
      >
        <EditorBar
          fileName={image.name}
          naturalWidth={image.natural.w}
          naturalHeight={image.natural.h}
          zoom={zoom}
          tool={tool}
          onToolChange={setTool}
        />
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px]">
          <CanvasStage
            status={status}
            doc={shown}
            image={image}
            onZoomChange={setZoom}
          />
          <aside
            aria-label="Inspector and layers"
            className="flex min-h-0 flex-col overflow-y-auto border-l bg-card"
          >
            <Inspector naturalWidth={image.natural.w} />
            <LayerList
              layers={layerRows(doc)}
              hidden={hidden}
              onToggleHidden={toggleHidden}
            />
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
      {sample && (
        <div className="flex shrink-0 flex-wrap gap-x-6 gap-y-1 border-t bg-card px-4 py-2 text-sm text-muted-foreground">
          <p>
            This is the sample, with the design file’s sample layers. No tool
            draws yet.
          </p>
          <SampleCredit />
        </div>
      )}
    </div>
  );
};
