"use client";

import { useEffect } from "react";
import { fromWebAnnotations } from "@/export/annotations";
import { addAnnotation } from "@/model/doc";
import { annotationCount } from "@/model/describe";
import { useSessionStore } from "../session-store";
import type { Notice } from "./use-copy";

const isJson = (file: File) =>
  file.type === "application/json" || file.name.endsWith(".json");

/**
 * Annotations exported as JSON, dropped on the editor, go back onto the image they point at, as
 * one undo step; any already there are left as they are.
 */
export const useJsonImport = (onNotice: (notice: Notice) => void) => {
  useEffect(() => {
    const over = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const drop = async (event: DragEvent) => {
      const file = event.dataTransfer?.files[0];
      if (!file || !isJson(file)) return;
      event.preventDefault();
      const { session, actions } = useSessionStore.getState();
      if (session?.state !== "ready") return;
      let json: unknown;
      try {
        json = JSON.parse(await file.text());
      } catch {
        onNotice({ text: `${file.name} isn’t JSON.`, error: true });
        return;
      }
      const read = fromWebAnnotations(json, session.hash);
      if (!read.ok) {
        onNotice({ text: read.reason, error: true });
        return;
      }
      const fresh = read.annotations.filter((a) => !session.doc.byId.has(a.id));
      actions.edit(
        (doc) => fresh.reduce((next, a) => addAnnotation(next, a), doc),
        "Import",
      );
      onNotice({
        text: `Added ${annotationCount(fresh.length)} from ${file.name}.`,
      });
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [onNotice]);
};
