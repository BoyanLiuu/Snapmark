"use client";

import { useEffect, useRef, useState } from "react";
import { EMPTY_HISTORY } from "@/history/undo";
import { debounced } from "@/lib/debounce";
import { forced, go, imageKey, parseRoute, useRoute } from "@/lib/route";
import { createDoc } from "@/model/doc";
import { hashBlob, shortKey } from "@/model/hash";
import { checkFormat, decodeImage } from "@/model/image";
import { findImage, keepImage, saveDoc } from "@/model/persist";
import {
  fetchSample,
  SAMPLE,
  SAMPLE_DOC,
  SAMPLE_MISSING,
} from "@/model/sample";
import { readStored, toStored } from "@/model/stored";
import type { Doc, Size } from "@/model/types";
import { makeThumb } from "@/render/thumb";
import { TOOL_IDS } from "./editor/tools";
import { setSession, useSessionStore } from "./session-store";

const SAVE_DELAY = 400;
const NONE: ReadonlySet<string> = new Set();

/**
 * The open image and its address. A chosen file is checked on the open screen, so one Snapmark
 * can't open is refused there; then the editor opens at once and decodes in place (screen 08),
 * while the bytes are hashed for the address. An address alone (a reload, the library) finds the
 * image in this browser. The annotations are saved 400 ms after the last change.
 */
export const useSession = () => {
  const route = useRoute();
  const session = useSessionStore((s) => s.session);
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
    const stored = await readStored(hash, image.natural, fresh);
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
    useSessionStore.setState({ tool: "select", selection: [] });
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
    // The address's ?tool= and ?select= (comma-separated ids).
    const route = parseRoute(window.location.hash);
    useSessionStore.setState({
      tool: forced(route, "tool", TOOL_IDS) ?? "select",
      selection: (route.query.get("select") ?? "").split(",").filter(Boolean),
    });
    setSession({ state: "decoding", key, name, natural, sample });
    // ?state=loading holds the image at screen 08; ?state=error shows screen 11.
    const state = forced(route, "state", ["loading", "error"]);
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

  return {
    route,
    session,
    refusal,
    openFile,
    openSample,
    home,
  };
};
