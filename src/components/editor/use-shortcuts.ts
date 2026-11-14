"use client";

import { useEffect, type RefObject } from "react";
import { moved } from "@/model/doc";
import { isTyping } from "@/lib/typing";
import { useSessionStore } from "../session-store";
import { TOOLS } from "./tools";
import { ZOOM_STEP, type StageCamera } from "./use-camera";

const TOOL_KEYS = new Map(TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id]));
const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Keys in a field or in a dialog are theirs. */
const ignored = (target: EventTarget | null) =>
  isTyping(target) ||
  (target instanceof Element &&
    target.closest('[role="dialog"], [role="alertdialog"]') !== null);

/**
 * The editor's keys (screen 24), in one place: tools, undo and redo, ⌘C, zoom, nudging and the
 * paint order. Esc, Delete and Space belong to the stage, which knows the gesture and the pointer.
 */
export const useShortcuts = (
  camera: StageCamera,
  copyRef: RefObject<{ copy: () => void } | null>,
) => {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (ignored(event.target)) return;
      const { actions, selection } = useSessionStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      const letter = event.key.toLowerCase();
      let handled = true;

      if (mod && letter === "z") {
        if (event.shiftKey) actions.redo();
        else actions.undo();
      } else if (mod && letter === "y") actions.redo();
      // ⌘C copies the PNG unless there is text selected on the page to copy.
      else if (mod && letter === "c" && !window.getSelection()?.toString())
        copyRef.current?.copy();
      else if (mod) handled = false;
      else if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      )
        actions.step(event.key === "ArrowUp" ? 1 : -1);
      else if (NUDGE[event.key] && selection.length > 0) {
        const k = event.shiftKey ? 10 : 1;
        const [dx, dy] = NUDGE[event.key];
        // A run of nudges is one undo entry.
        actions.edit(
          (doc) => moved(doc, selection, dx * k, dy * k),
          "Nudge",
          `nudge:${selection.join(",")}`,
        );
      } else if (event.shiftKey && event.code === "Digit1") camera.fit();
      else if (event.shiftKey && event.code === "Digit0") camera.actualSize();
      else if (event.key === "+" || event.key === "=") camera.zoomBy(ZOOM_STEP);
      else if (event.key === "-") camera.zoomBy(1 / ZOOM_STEP);
      else if (!event.shiftKey && !event.altKey && TOOL_KEYS.has(letter))
        actions.setTool(TOOL_KEYS.get(letter)!);
      else handled = false;

      if (handled) event.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [camera, copyRef]);
};
