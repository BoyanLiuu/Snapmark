"use client";

import { useMemo, useState } from "react";
import { toggle } from "@/lib/set";
import type { Box } from "@/model/bbox";
import {
  addAnnotation,
  removeAnnotations,
  translated,
  updateAnnotation,
  withoutIds,
} from "@/model/doc";
import type { LoadedImage } from "@/model/image";
import type { Annotation, Doc, Id, Size } from "@/model/types";
import { SampleNotice } from "../open/sample-notice";
import { AppBar } from "./app-bar";
import { CanvasStage, type StageActions } from "./canvas-stage";
import { EditorBar } from "./editor-bar";
import { defaultStroke, Inspector, type Style } from "./inspector";
import { Kbd } from "./kbd";
import { LayerList } from "./layer-list";
import { layerRows } from "./layers";
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

const NONE: ReadonlySet<Id> = new Set();

const newId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 8);

/** The look-related fields an annotation has, for the inspector. */
const styleOf = (a: Annotation): Style => ({
  color: a.color,
  strokeWidth: a.strokeWidth,
  opacity: a.opacity,
});

/**
 * Screen 09: app bar, editor bar, the stage with its status strip, and the rail with the
 * inspector above the layers. While the image decodes the stage and the layers say so (08); an
 * image with nothing on it offers a first box (10). The rectangle draws and anything selects,
 * moves and deletes (12, 13).
 */
export const EditorShell = ({
  session,
  onDocChange,
  onClose,
}: {
  session: Session;
  /** Every change to the document goes up from here: one per gesture. */
  onDocChange: (doc: Doc) => void;
  onClose: () => void;
}) => {
  const [tool, setTool] = useState<ToolId>("select");
  const [zoom, setZoom] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<Id>>(NONE);
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The next annotation's look; the stroke follows the image's width until it is set by hand.
  const [defaults, setDefaults] = useState<
    Omit<Style, "strokeWidth"> & { strokeWidth: number | null }
  >({
    color: "red",
    strokeWidth: null,
    opacity: 1,
  });

  const ready = session.state === "ready" ? session : null;
  const name = session.state === "ready" ? session.image.name : session.name;
  const natural =
    session.state === "ready" ? session.image.natural : session.natural;
  const doc = ready?.doc ?? null;
  const shown = useMemo(
    () => (doc ? withoutIds(doc, hidden) : null),
    [doc, hidden],
  );
  const selected = (selectedId && doc?.byId.get(selectedId)) || null;
  const style: Style = {
    ...defaults,
    strokeWidth: defaults.strokeWidth ?? defaultStroke(natural?.w ?? 0),
  };

  const draft = (box: Box): Annotation => ({
    id: "draft",
    kind: "rect",
    ...style,
    ...box,
  });

  const change = (next: Doc) => {
    setNotice(null);
    onDocChange(next);
  };

  const actions: StageActions = {
    onSelect: setSelectedId,
    onDraw: (box) => {
      if (!doc) return;
      const id = newId();
      change(addAnnotation(doc, { ...draft(box), id }));
      setSelectedId(id);
    },
    onMove: (id, dx, dy) => {
      const a = doc?.byId.get(id);
      if (doc && a) change(updateAnnotation(doc, id, translated(a, dx, dy)));
    },
    onDelete: () => {
      if (!doc || !selectedId) return;
      change(removeAnnotations(doc, new Set([selectedId])));
      setSelectedId(null);
    },
    onDrawBox: () => {
      setTool("rect");
      setNotice("Rectangle: drag across the picture to draw a box.");
    },
  };

  const restyle = (patch: Partial<Style>) => {
    if (selected && doc) change(updateAnnotation(doc, selected.id, patch));
    else setDefaults((current) => ({ ...current, ...patch }));
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
          onToolChange={(next) => {
            setTool(next);
            setNotice(null);
          }}
        />
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px]">
          <CanvasStage
            status={doc ? (notice ?? statusLine(doc)) : ""}
            image={ready?.image ?? null}
            doc={shown}
            decoding={ready ? null : { name, natural }}
            tool={tool}
            selected={selected?.id ?? null}
            draft={draft}
            actions={actions}
            onZoomChange={setZoom}
          />
          <aside
            aria-label="Inspector and layers"
            className="flex min-h-0 flex-col overflow-y-auto border-l bg-card"
          >
            {ready ? (
              <Inspector
                subject={
                  selected
                    ? { selected }
                    : { naturalWidth: ready.image.natural.w }
                }
                style={selected ? styleOf(selected) : style}
                onChange={restyle}
                onDelete={actions.onDelete}
              />
            ) : (
              <div className="min-h-12 border-b" />
            )}
            <LayerList
              layers={doc ? layerRows(doc) : null}
              hidden={hidden}
              selected={selected?.id ?? null}
              onSelect={setSelectedId}
              onToggleHidden={(id) =>
                setHidden((current) => toggle(current, id))
              }
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
