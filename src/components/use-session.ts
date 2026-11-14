"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { EMPTY_HISTORY, record, redo, seal, undo } from "@/history/undo";
import { toggle } from "@/lib/set";
import { debounced } from "@/lib/debounce";
import {
  forced,
  go,
  imageKey,
  parseRoute,
  setQuery,
  useRoute,
} from "@/lib/route";
import { createDoc } from "@/model/doc";
import { hashBlob, shortKey } from "@/model/hash";
import { checkFormat, decodeImage } from "@/model/image";
import { findImage, keepImage, readDoc, saveDoc } from "@/model/persist";
import {
  fetchSample,
  SAMPLE,
  SAMPLE_DOC,
  SAMPLE_MISSING,
} from "@/model/sample";
import { fromStored, toStored } from "@/model/stored";
import type { Doc, Size } from "@/model/types";
import { makeThumb } from "@/render/thumb";
import type { Editing, EditorSession } from "./editor/editor-shell";

/** An address being looked up, one this browser doesn't have (screen 32), or an open image. */
export type Session =
  | { state: "finding"; key: string }
  | { state: "missing"; key: string }
  | EditorSession;

type Ready = Extract<Session, { state: "ready" }>;

const SAVE_DELAY = 400;
const NONE: ReadonlySet<string> = new Set();

/** The stored annotations, or `fresh` when there are none; `unreadable` when they can't be read (screen 11). */
const storedDoc = async (hash: string, natural: Size, fresh: Doc) => {
  try {
    const stored = await readDoc(hash);
    if (stored === undefined) return { doc: fresh, unreadable: false };
    const doc = fromStored(stored, natural);
    return { doc: doc ?? fresh, unreadable: !doc };
  } catch {
    return { doc: fresh, unreadable: true };
  }
};

/** Every change goes through here with its history, so an edit and its undo entry never drift. */
const editingFor = (
  setSession: Dispatch<SetStateAction<Session | null>>,
): Editing => {
  const onReady = (step: (s: Ready) => Ready) =>
    setSession((s) => (s?.state === "ready" ? step(s) : s));
  const travel = (s: Ready, done: ReturnType<typeof undo>) =>
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
    toggleHidden: (id) =>
      onReady((s) => ({ ...s, hidden: toggle(s.hidden, id) })),
  };
};

/**
 * The open image and its address. A chosen file is checked on the open screen, so one Snapmark
 * can't open is refused there; then the editor opens at once and decodes in place (screen 08),
 * while the bytes are hashed for the address. An address alone (a reload, the library) finds the
 * image in this browser. The annotations are saved 400 ms after the last change.
 */
export const useSession = () => {
  const route = useRoute();
  const [session, setSession] = useState<Session | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Each open takes a ticket; work for an older one, or for a closed image, is dropped.
  const ticket = useRef(0);
  // The key of the image open or opening, read when the address changes.
  const liveKey = useRef<string | null>(null);
  const [saver] = useState(() =>
    debounced(({ hash, doc }: { hash: string; doc: Doc }) => {
      saveDoc(toStored(hash, doc)).catch(() => {});
    }, SAVE_DELAY),
  );
  const flush = saver.flush;

  /** `known`: an image found by its address, with its hash, and whether the address forces screen 11. */
  const load = async (
    mine: number,
    blob: Blob,
    name: string,
    sample: boolean,
    known?: { hash: string; unreadable: boolean },
  ) => {
    const live = () => ticket.current === mine;
    const hash = known?.hash ?? (await hashBlob(blob));
    if (!live()) return;
    const key = shortKey(hash);
    liveKey.current = key;
    setSession((s) => (s?.state === "decoding" ? { ...s, key } : s));
    if (parseRoute(window.location.hash).page === "open")
      go(`#/annotate/${key}`);

    const opened = await decodeImage(blob, name);
    if (!live()) {
      if (opened.ok) opened.image.bitmap.close();
      return;
    }
    if (!opened.ok) {
      home();
      setRefusal(opened.reason);
      return;
    }
    const { image } = opened;
    const fresh = sample ? SAMPLE_DOC : createDoc(image.natural);
    const stored = await storedDoc(hash, image.natural, fresh);
    if (!live()) {
      image.bitmap.close();
      return;
    }
    setSession({
      state: "ready",
      key,
      hash,
      image,
      doc: stored.doc,
      history: EMPTY_HISTORY,
      hidden: NONE,
      sample,
      unreadable: stored.unreadable || (known?.unreadable ?? false),
    });
    if (!known)
      makeThumb(image.bitmap)
        .then((thumb) =>
          keepImage({
            hash,
            name,
            natural: image.natural,
            blob,
            thumb,
            sample,
            addedAt: Date.now(),
          }),
        )
        .catch(() => {});
  };

  const opening = (name: string, natural: Size | null, sample: boolean) => {
    flush();
    setRefusal(null);
    setSession({ state: "decoding", key: null, name, natural, sample });
    return ++ticket.current;
  };

  const openFile = async (file: File) => {
    const name = file.name || "Pasted image";
    const check = await checkFormat(file, name);
    if (!check.ok) {
      setRefusal(check.reason);
      return;
    }
    load(opening(name, null, false), file, name, false);
  };

  const openSample = async () => {
    const mine = opening(SAMPLE.name, SAMPLE.size, true);
    const blob = await fetchSample();
    if (ticket.current !== mine) return;
    if (blob) load(mine, blob, SAMPLE.name, true);
    else {
      close();
      setRefusal(SAMPLE_MISSING);
    }
  };

  const find = async (key: string) => {
    flush();
    const mine = ++ticket.current;
    liveKey.current = key;
    setSession({ state: "finding", key });
    const image = await findImage(key).catch(() => undefined);
    if (ticket.current !== mine) return;
    if (!image) {
      setSession({ state: "missing", key });
      return;
    }
    const { name, natural, sample } = image;
    setSession({ state: "decoding", key, name, natural, sample });
    // ?state=loading holds the image at screen 08; ?state=error shows screen 11.
    const state = forced(parseRoute(window.location.hash), "state", [
      "loading",
      "error",
    ]);
    if (state === "loading") return;
    load(mine, image.blob, name, sample, {
      hash: image.hash,
      unreadable: state === "error",
    });
  };

  const close = () => {
    flush();
    ticket.current += 1;
    liveKey.current = null;
    setSession((s) => {
      // Frames drawn after this skip a closed bitmap (render/scene.ts).
      if (s?.state === "ready") s.image.bitmap.close();
      return null;
    });
  };

  const home = () => {
    close();
    go("#/");
  };

  const recovery = {
    retry: async () => {
      if (session?.state !== "ready") return;
      setQuery({ state: null });
      const { hash, image, doc } = session;
      const read = await storedDoc(hash, image.natural, doc);
      setSession((s) =>
        s?.state === "ready" && s.hash === hash ? { ...s, ...read } : s,
      );
    },
    startFresh: () => {
      setQuery({ state: null });
      setSession((s) =>
        s?.state === "ready" ? { ...s, unreadable: false } : s,
      );
    },
  };

  // The address changed: back, forward, a link or a reload.
  const routeKey = imageKey(route);
  useEffect(() => {
    if (routeKey === null) {
      if (liveKey.current) close();
    } else if (liveKey.current !== routeKey) find(routeKey);
    // close and find only touch refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const doc = session?.state === "ready" ? session.doc : null;
  useEffect(() => {
    if (session?.state !== "ready" || session.unreadable) return;
    saver.schedule({ hash: session.hash, doc: session.doc });
    // Saved when the document changes, not on every session change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const editing = useMemo(() => editingFor(setSession), []);

  return {
    route,
    session,
    refusal,
    editing,
    recovery,
    openFile,
    openSample,
    home,
  };
};
