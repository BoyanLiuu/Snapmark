"use client";

import { useMemo, useState } from "react";
import { toggle } from "@/lib/set";
import { withoutIds } from "@/model/doc";
import type { LoadedImage } from "@/model/image";
import type { Doc, Id, Size } from "@/model/types";
import { SampleNotice } from "../open/sample-notice";
import { AppBar } from "./app-bar";
import { CanvasStage } from "./canvas-stage";
import { EditorBar } from "./editor-bar";
import { Inspector } from "./inspector";
import { LayerList } from "./layer-list";
import { layerRows } from "./layers";
import { Kbd } from "./kbd";
import { statusLine } from "./status";
import type { ToolId } from "./tools";

/** An open image: decoding (screen 08), or ready with its document. */
export type Session =
  | {
      state: "decoding";
      name: string;
      /** Known before decoding only for the sample. */
      natural: Size | null;
      sample: boolean;
    }
  | { state: "ready"; image: LoadedImage; doc: Doc; sample: boolean };

const NO_DOC_HIDDEN: ReadonlySet<Id> = new Set();

/**
 * Screen 09: app bar, editor bar, the stage with its status strip, and the rail with the
 * inspector above the layers. While the image decodes the stage and the layers show it (08); an
 * image with nothing on it says so and offers a first box (10). No tool draws yet.
 */
export const EditorShell = ({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) => {
  const [tool, setTool] = useState<ToolId>("select");
  const [zoom, setZoom] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<Id>>(NO_DOC_HIDDEN);
  const [notice, setNotice] = useState<string | null>(null);

  const ready = session.state === "ready" ? session : null;
  const name = session.state === "ready" ? session.image.name : session.name;
  const natural =
    session.state === "ready" ? session.image.natural : session.natural;
  const shown = useMemo(
    () => (ready ? withoutIds(ready.doc, hidden) : null),
    [ready, hidden],
  );

  const toggleHidden = (id: Id) => setHidden((current) => toggle(current, id));

  const chooseTool = (next: ToolId) => {
    setTool(next);
    setNotice(null);
  };

  const drawBox = () => {
    setTool("rect");
    setNotice(
      "Rectangle: drag across the picture to draw a box. Drawing arrives in M5.",
    );
  };

  return (
    <div className="flex h-dvh min-h-[560px] flex-col">
      <AppBar variant="app" onHome={onClose} />
      <main
        aria-labelledby="editor-file"
        className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]"
      >
        <EditorBar
          fileName={name}
          natural={natural}
          zoom={ready ? zoom : null}
          tool={tool}
          onToolChange={chooseTool}
        />
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px]">
          <CanvasStage
            status={ready ? (notice ?? statusLine(ready.doc)) : ""}
            image={ready?.image ?? null}
            doc={shown}
            decoding={ready ? null : { name, natural }}
            onDrawBox={drawBox}
            onZoomChange={setZoom}
          />
          <aside
            aria-label="Inspector and layers"
            className="flex min-h-0 flex-col overflow-y-auto border-l bg-card"
          >
            {ready ? (
              <Inspector naturalWidth={ready.image.natural.w} />
            ) : (
              <div className="min-h-12 border-b" />
            )}
            <LayerList
              layers={ready ? layerRows(ready.doc) : null}
              hidden={hidden}
              onToggleHidden={toggleHidden}
            />
            <p className="mt-auto px-6 py-4 text-sm text-muted-foreground">
              Drag a row, or press <Kbd>⌥ ↑</Kbd>, to change what sits on top.
            </p>
          </aside>
        </div>
      </main>
      {session.sample && <SampleNotice />}
    </div>
  );
};
