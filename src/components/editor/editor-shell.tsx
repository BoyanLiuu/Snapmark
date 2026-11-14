"use client";

import { useEffect, useMemo, useState } from "react";
import { degenerate } from "@/geom/arrow";
import type { History } from "@/history/undo";
import { drawn } from "@/interact/draft";
import type { DrawTool } from "@/interact/machine";
import { toggle } from "@/lib/set";
import { isTyping } from "@/lib/typing";
import {
  addAnnotation,
  removeAnnotations,
  translated,
  updateAnnotation,
  withoutIds,
} from "@/model/doc";
import type { LoadedImage } from "@/model/image";
import type { Annotation, Doc, Id, Point, Size } from "@/model/types";
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

/** An open image: decoding (screen 08), or ready with its document and its history. */
export type Session =
  | {
      state: "decoding";
      name: string;
      /** Known before decoding only for the sample. */
      natural: Size | null;
      sample: boolean;
    }
  | {
      state: "ready";
      image: LoadedImage;
      doc: Doc;
      history: History;
      sample: boolean;
    };

export interface Editing {
  /** One change, one undo entry; a `group` merges a run of changes (a slider drag) into one. */
  edit: (fn: (doc: Doc) => Doc, label: string, group?: string) => void;
  seal: () => void;
  undo: () => void;
  redo: () => void;
}

const NONE: ReadonlySet<Id> = new Set();

const newId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 8);

const styleOf = (a: Annotation): Style => ({
  color: a.color,
  strokeWidth: a.strokeWidth,
  opacity: a.opacity,
});

/**
 * Screen 09: app bar, editor bar, the stage with its status strip, and the rail with the
 * inspector above the layers, through every state from decoding (08) to a shape selected (13, 20).
 */
export const EditorShell = ({
  session,
  editing,
  onClose,
}: {
  session: Session;
  editing: Editing;
  onClose: () => void;
}) => {
  const [tool, setTool] = useState<ToolId>("select");
  const [zoom, setZoom] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<Id>>(NONE);
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The stroke follows the image's width until it is set by hand.
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
  const history = ready?.history;

  const edit: Editing["edit"] = (fn, label, group) => {
    setNotice(null);
    editing.edit(fn, label, group);
  };

  const draft = (kind: DrawTool, from: Point, to: Point) =>
    drawn(kind, from, to, style, "draft");

  const actions: StageActions = {
    onSelect: setSelectedId,
    onDraw: (kind, from, to) => {
      const a = drawn(kind, from, to, style, newId());
      if (a.kind === "arrow" && degenerate(a)) return;
      edit((d) => addAnnotation(d, a), "Draw");
      setSelectedId(a.id);
    },
    onMove: (id, dx, dy) =>
      edit((d) => {
        const a = d.byId.get(id);
        return a ? updateAnnotation(d, id, translated(a, dx, dy)) : d;
      }, "Move"),
    onReshape: (id, patch) =>
      edit((d) => updateAnnotation(d, id, patch), "Resize"),
    onDelete: () => {
      if (!selectedId) return;
      edit((d) => removeAnnotations(d, new Set([selectedId])), "Delete");
      setSelectedId(null);
    },
    onDrawBox: () => {
      setTool("rect");
      setNotice("Rectangle: drag across the picture to draw a box.");
    },
  };

  const restyle = (patch: Partial<Style>) => {
    if (!selected) return setDefaults((current) => ({ ...current, ...patch }));
    // A slider drag is one entry until it is let go; each colour pick is its own.
    const group =
      "color" in patch ? undefined : `${Object.keys(patch)[0]}:${selected.id}`;
    edit((d) => updateAnnotation(d, selected.id, patch), "Restyle", group);
  };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (isTyping(event.target) || !(event.metaKey || event.ctrlKey)) return;
      const z = event.key.toLowerCase() === "z";
      if (z && !event.shiftKey) editing.undo();
      else if ((z && event.shiftKey) || event.key.toLowerCase() === "y")
        editing.redo();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [editing]);

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
          undoLabel={history?.past.at(-1)?.label ?? null}
          redoLabel={history?.future[0]?.label ?? null}
          onUndo={editing.undo}
          onRedo={editing.redo}
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
                onCommit={editing.seal}
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
