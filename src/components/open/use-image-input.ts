"use client";

import { useEffect, useRef, useState } from "react";

const carriesFiles = (event: DragEvent) =>
  [...(event.dataTransfer?.types ?? [])].includes("Files");

/**
 * Files dropped anywhere on the page, or pasted, go to `onFile`. Returns whether a file is being
 * dragged over the page, for the whole-page drop state (screen 02).
 */
export const useImageInput = (onFile: (file: File) => void) => {
  const [dragging, setDragging] = useState(false);
  const onFileRef = useRef(onFile);

  useEffect(() => {
    onFileRef.current = onFile;
  }, [onFile]);

  useEffect(() => {
    // dragenter and dragleave fire for every element crossed; count them to know when the
    // pointer has left the page rather than moved between children.
    let depth = 0;
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    // Without this the browser opens the dropped file itself, replacing the app.
    const over = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file) onFileRef.current(file);
    };
    const paste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find(
        (entry) => entry.kind === "file",
      );
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      onFileRef.current(file);
    };
    document.addEventListener("dragenter", enter);
    document.addEventListener("dragleave", leave);
    document.addEventListener("dragover", over);
    document.addEventListener("drop", drop);
    document.addEventListener("paste", paste);
    return () => {
      document.removeEventListener("dragenter", enter);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("dragover", over);
      document.removeEventListener("drop", drop);
      document.removeEventListener("paste", paste);
    };
  }, []);

  return dragging;
};
