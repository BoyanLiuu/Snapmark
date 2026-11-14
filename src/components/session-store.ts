"use client";

import { create } from "zustand";
import { record, redo, seal, undo } from "@/history/undo";
import { setQuery } from "@/lib/route";
import { toggle } from "@/lib/set";
import { reorder } from "@/model/doc";
import { readStored } from "@/model/stored";
import type { Doc, Id } from "@/model/types";
import type { EditorSession } from "./editor/editor-shell";
import type { ToolId } from "./editor/tools";

/** An address being looked up, one this browser doesn't have (screen 32), or an open image. */
export type Session =
  | { state: "finding"; key: string }
  | { state: "missing"; key: string }
  | EditorSession;

type Ready = Extract<Session, { state: "ready" }>;

interface SessionState {
  session: Session | null;
  /** The editor's tool and selection: one image's, set when it opens (from its address, M10). */
  tool: ToolId;
  selection: readonly Id[];
  actions: {
    /** One change, one undo entry; a `group` merges a run of changes (a slider drag) into one. */
    edit: (fn: (doc: Doc) => Doc, label: string, group?: string) => void;
    seal: () => void;
    undo: () => void;
    redo: () => void;
    toggleHidden: (id: Id) => void;
    /** The one selected annotation a step up (1) or down (-1) the paint order. */
    step: (delta: 1 | -1) => void;
    setTool: (tool: ToolId) => void;
    select: (ids: readonly Id[]) => void;
    /** Screen 11: read the stored annotations again, or carry on without them. */
    retry: () => Promise<void>;
    startFresh: () => void;
  };
}

/**
 * The open image, its document and history, and the editor's tool and selection: one owner for
 * each, read by whichever component needs it. Every change goes through `edit` with its history,
 * so an edit and its undo entry never drift. Client state only: nothing writes it on the server.
 */
export const useSessionStore = create<SessionState>()((set, get) => {
  const onReady = (step: (s: Ready) => Ready) =>
    set(({ session }) =>
      session?.state === "ready" ? { session: step(session) } : {},
    );
  const travel = (s: Ready, done: ReturnType<typeof undo>) =>
    done ? { ...s, history: done[0], doc: done[1] } : s;

  return {
    session: null,
    tool: "select",
    selection: [],
    actions: {
      edit: (fn, label, group) =>
        onReady((s) => {
          const doc = fn(s.doc);
          return doc === s.doc
            ? s
            : {
                ...s,
                doc,
                history: record(s.history, s.doc, doc, label, group),
              };
        }),
      seal: () => onReady((s) => ({ ...s, history: seal(s.history) })),
      undo: () => onReady((s) => travel(s, undo(s.history, s.doc))),
      redo: () => onReady((s) => travel(s, redo(s.history, s.doc))),
      toggleHidden: (id) =>
        onReady((s) => ({ ...s, hidden: toggle(s.hidden, id) })),
      step: (delta) => {
        const { selection, actions } = get();
        if (selection.length !== 1) return;
        const [id] = selection;
        actions.edit(
          (doc) => reorder(doc, id, doc.order.indexOf(id) + delta),
          "Reorder",
        );
      },
      setTool: (tool) => set({ tool }),
      select: (selection) => set({ selection }),
      retry: async () => {
        const { session } = get();
        if (session?.state !== "ready") return;
        setQuery({ state: null });
        const { hash, image, doc } = session;
        const read = await readStored(hash, image.natural, doc);
        onReady((s) => (s.hash === hash ? { ...s, ...read } : s));
      },
      startFresh: () => {
        setQuery({ state: null });
        onReady((s) => ({ ...s, unreadable: false }));
      },
    },
  };
});

export const useSessionActions = () => useSessionStore((s) => s.actions);

/** Replaces the session; the setter form reads the one in the store. */
export const setSession = (
  next: Session | null | ((s: Session | null) => Session | null),
) =>
  useSessionStore.setState(({ session }) => ({
    session: typeof next === "function" ? next(session) : next,
  }));
