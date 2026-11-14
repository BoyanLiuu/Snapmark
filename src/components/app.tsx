"use client";

import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  EMPTY_HISTORY,
  record,
  redo,
  seal,
  undo,
  type History,
} from "@/history/undo";
import { createDoc } from "@/model/doc";
import { checkFormat, decodeBitmap, type OpenResult } from "@/model/image";
import { loadSample, SAMPLE, SAMPLE_DOC } from "@/model/sample";
import type { Doc, Size } from "@/model/types";
import { EditorShell, type Editing, type Session } from "./editor/editor-shell";
import { OpenScreen } from "./open/open-screen";

type Ready = Extract<Session, { state: "ready" }>;

/** Every change goes through here with its history, so an edit and its undo entry never drift. */
const editingFor = (
  setSession: Dispatch<SetStateAction<Session | null>>,
): Editing => {
  const onReady = (step: (s: Ready) => Ready) =>
    setSession((s) => (s?.state === "ready" ? step(s) : s));
  const travel = (s: Ready, done: [History, Doc] | null) =>
    done ? { ...s, history: done[0], doc: done[1] } : s;
  return {
    edit: (fn, label, group) =>
      onReady((s) => {
        const doc = fn(s.doc);
        return doc === s.doc
          ? s
          : { ...s, doc, history: record(s.history, s.doc, doc, label, group) };
      }),
    seal: () => onReady((s) => ({ ...s, history: seal(s.history) })),
    undo: () => onReady((s) => travel(s, undo(s.history, s.doc))),
    redo: () => onReady((s) => travel(s, redo(s.history, s.doc))),
  };
};

/**
 * Open an image, then annotate it. A file is checked on the open screen, so one Snapmark can't
 * open is refused there; then the editor opens at once and decodes in place (screen 08). Hash
 * routes replace this switch in M10.
 */
export const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Each open takes a ticket; a decode that finishes after a newer open, or after closing, is
  // dropped and its bitmap closed.
  const ticket = useRef(0);

  const begin = (
    name: string,
    natural: Size | null,
    sample: boolean,
    load: () => Promise<OpenResult>,
  ) => {
    const mine = ++ticket.current;
    setRefusal(null);
    setSession({ state: "decoding", name, natural, sample });
    load().then((result) => {
      if (ticket.current !== mine) {
        if (result.ok) result.image.bitmap.close();
        return;
      }
      if (!result.ok) {
        setSession(null);
        setRefusal(result.reason);
        return;
      }
      const doc = sample ? SAMPLE_DOC : createDoc(result.image.natural);
      setSession({
        state: "ready",
        image: result.image,
        doc,
        history: EMPTY_HISTORY,
        sample,
      });
    });
  };

  const openFile = async (file: File) => {
    const name = file.name || "Pasted image";
    const check = await checkFormat(file, name);
    if (!check.ok) {
      setRefusal(check.reason);
      return;
    }
    begin(name, null, false, () => decodeBitmap(file, name, check.format));
  };

  const openSample = () => begin(SAMPLE.name, SAMPLE.size, true, loadSample);

  const close = () => {
    ticket.current += 1;
    // Frames drawn after this skip a closed bitmap (render/scene.ts).
    if (session?.state === "ready") session.image.bitmap.close();
    setSession(null);
  };

  const editing = useMemo(() => editingFor(setSession), []);

  return session ? (
    <EditorShell session={session} editing={editing} onClose={close} />
  ) : (
    <OpenScreen refusal={refusal} onFile={openFile} onSample={openSample} />
  );
};
