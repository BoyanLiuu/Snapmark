"use client";

import { useRef, type Ref } from "react";
import { toScreen, type Camera } from "@/geom/matrix";
import { swatch } from "@/model/palette";
import type { TextA } from "@/model/types";
import { PLATE } from "@/render/draw/text";
import { LINE, PLATE_PAD, TEXT_STACK, TEXT_WEIGHT } from "@/render/text-layout";

/** Grows the textarea to its text, so it never scrolls. */
const fitHeight = (el: HTMLTextAreaElement) => {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

/**
 * Lays the editor over its label at this camera: the same font, size, line height and wrap width
 * as the canvas draws, so the words sit where they will be drawn. Called on every frame.
 */
export const placeTextEditor = (
  el: HTMLTextAreaElement,
  a: TextA,
  camera: Camera,
) => {
  const at = toScreen(camera, { x: a.x, y: a.y });
  const size = a.fontSize * camera.scale;
  const pad = a.plate ? size * PLATE_PAD : 0;
  Object.assign(el.style, {
    left: `${at.x - pad}px`,
    top: `${at.y - pad}px`,
    width: `${a.width * camera.scale + 2 * pad}px`,
    padding: `${pad}px`,
    fontSize: `${size}px`,
  });
  fitHeight(el);
  // Shown, and given focus, once it first sits over its label: a hidden element can't take focus.
  if (el.style.visibility === "hidden") {
    el.style.visibility = "visible";
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }
};

/**
 * Screen 17: a label edited in a textarea over the canvas (ARCHITECTURE.md §8). It commits on
 * blur or ⌘Enter, and Esc leaves the label as it was; `onDone` gets the text, or null to cancel.
 */
export const TextEditor = ({
  annotation,
  onDone,
  ref,
}: {
  annotation: TextA;
  onDone: (text: string | null) => void;
  ref: Ref<HTMLTextAreaElement>;
}) => {
  // Once done, a blur from the element going away must not finish it twice.
  const done = useRef(false);
  const finish = (text: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(text);
  };

  return (
    <textarea
      ref={ref}
      aria-label="Label text"
      data-testid="text-editor"
      defaultValue={annotation.text}
      rows={1}
      spellCheck={false}
      style={{
        fontFamily: TEXT_STACK,
        fontWeight: TEXT_WEIGHT,
        lineHeight: LINE,
        color: swatch(annotation.color).css,
        background: annotation.plate ? PLATE : "transparent",
        opacity: annotation.opacity,
        // Until the first frame places it.
        visibility: "hidden",
      }}
      className="absolute z-20 resize-none overflow-hidden border-0 p-0 outline-1 outline-offset-0 outline-primary outline-dashed"
      onInput={(event) => fitHeight(event.currentTarget)}
      onBlur={(event) => finish(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
        } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          finish(event.currentTarget.value);
        }
      }}
    />
  );
};
