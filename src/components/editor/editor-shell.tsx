"use client";

import { sizeText } from "@/lib/text";
import { useEffect, useMemo, useState } from "react";
import { degenerate } from "@/geom/arrow";
import type { History } from "@/history/undo";
import { renderPng } from "@/export/render";
import { drawn } from "@/interact/draft";
import type { DrawTool } from "@/interact/machine";
import { forced, go, setQuery, type Route } from "@/lib/route";
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
import { Unreadable } from "./unreadable";
import { useCopy, type Notice } from "./use-copy";
import { TOOL_IDS, type ToolId } from "./tools";

/** An open image: decoding (screen 08), or ready with its document and its history. */
export type EditorSession =
  | {
      state: "decoding";
      /** Null until the bytes are hashed. */
      key: string | null;
      name: string;
      /** Known before decoding for the sample and for an image kept in this browser. */
      natural: Size | null;
      sample: boolean;
    }
  | {
      state: "ready";
      key: string;
      hash: string;
      image: LoadedImage;
      doc: Doc;
      history: History;
      /** Hidden from the canvas and the export, not from the document. */
      hidden: ReadonlySet<Id>;
      sample: boolean;
      /** The stored annotations couldn't be read (screen 11). */
      unreadable: boolean;
    };

export interface Editing {
  /** One change, one undo entry; a `group` merges a run of changes (a slider drag) into one. */
  edit: (fn: (doc: Doc) => Doc, label: string, group?: string) => void;
  seal: () => void;
  undo: () => void;
  redo: () => void;
  toggleHidden: (id: Id) => void;
}

const NONE: ReadonlySet<Id> = new Set();

/** The image's name and natural size, known or not yet, whatever the state. */
export const imageOf = (session: EditorSession) =>
  session.state === "ready"
    ? { name: session.image.name, natural: session.image.natural }
    : { name: session.name, natural: session.natural };

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
  route,
  session,
  editing,
  recovery,
  onHome,
}: {
  route: Route;
  session: EditorSession;
  editing: Editing;
  recovery: { retry: () => void; startFresh: () => void };
  onHome: () => void;
}) => {
  // The address's ?tool= and ?select= on opening; M15 selects more than one.
  const [tool, setTool] = useState<ToolId>(
    () => forced(route, "tool", TOOL_IDS) ?? "select",
  );
  const [selectedId, setSelectedId] = useState<Id | null>(
    () => route.query.get("select")?.split(",")[0] || null,
  );
  const [zoom, setZoom] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // The stroke follows the image's width until it is set by hand.
  const [defaults, setDefaults] = useState<
    Omit<Style, "strokeWidth"> & { strokeWidth: number | null }
  >({
    color: "red",
    strokeWidth: null,
    opacity: 1,
  });

  const ready = session.state === "ready" ? session : null;
  const { name, natural } = imageOf(session);
  // While the stored annotations can't be read, the picture shows under screen 11 with none.
  const unreadable = ready?.unreadable ?? false;
  const doc = ready?.doc ?? null;
  const hidden = ready?.hidden ?? NONE;
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
      setNotice({ text: "Rectangle: drag across the picture to draw a box." });
    },
  };

  const restyle = (patch: Partial<Style>) => {
    if (!selected) return setDefaults((current) => ({ ...current, ...patch }));
    // A slider drag is one entry until it is let go; each colour pick is its own.
    const group =
      "color" in patch ? undefined : `${Object.keys(patch)[0]}:${selected.id}`;
    edit((d) => updateAnnotation(d, selected.id, patch), "Restyle", group);
  };

  const copying = useCopy(
    () =>
      ready
        ? renderPng(withoutIds(ready.doc, ready.hidden), ready.image.bitmap)
        : Promise.reject(new Error("the image is still opening.")),
    { name, size: natural ? sizeText(natural) : "" },
    setNotice,
    route,
  );

  const status = (): Notice | null => {
    if (notice) return notice;
    if (!doc || unreadable) return null;
    // While Copy downloads instead, the strip says why (screens 22, 23).
    if (copying.reason) return { text: copying.reason, error: copying.blocked };
    return { text: statusLine(doc) };
  };

  // The tool and the selection live in the address, so a state can be copied out of it.
  const live = ready !== null;
  const selection = selected?.id ?? null;
  useEffect(() => {
    if (!live) return;
    setQuery({ tool: tool === "select" ? null : tool, select: selection });
  }, [live, tool, selection]);

  const exportPage = () => {
    const clipboard = route.query.get("clipboard");
    go(
      `#/annotate/${ready?.key}/export${clipboard ? `?clipboard=${clipboard}` : ""}`,
    );
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
      <AppBar variant="app" onHome={onHome} />
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
          copy={ready ? copying : null}
          onExport={exportPage}
        />
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px]">
          <CanvasStage
            status={status()}
            image={ready?.image ?? null}
            doc={shown}
            decoding={ready ? null : { name, natural }}
            tool={tool}
            selected={selected?.id ?? null}
            draft={draft}
            actions={actions}
            onZoomChange={setZoom}
          >
            {unreadable && <Unreadable {...recovery} />}
          </CanvasStage>
          <aside
            aria-label="Inspector and layers"
            className="flex min-h-0 flex-col overflow-y-auto border-l bg-card"
          >
            {ready && !unreadable ? (
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
              layers={doc && !unreadable ? layerRows(doc) : null}
              unreadable={unreadable}
              hidden={hidden}
              selected={selected?.id ?? null}
              onSelect={setSelectedId}
              onToggleHidden={editing.toggleHidden}
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
