"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "./kbd";

const ROWS: [ReactNode, ReactNode][] = [
  [
    <>
      <Kbd>V</Kbd> <Kbd>R</Kbd> <Kbd>A</Kbd> <Kbd>H</Kbd> <Kbd>T</Kbd>{" "}
      <Kbd>P</Kbd>
    </>,
    "Select, rectangle, arrow, highlight, text, pixelate",
  ],
  [
    <>
      <Kbd>⌘ Z</Kbd> and <Kbd>⇧ ⌘ Z</Kbd>
    </>,
    "Undo and redo, one step per finished drag",
  ],
  [<Kbd key="c">⌘ C</Kbd>, "Copy the PNG at the image’s own size"],
  [<Kbd key="d">Delete</Kbd>, "Delete what’s selected"],
  ["Space and drag", "Pan, whichever tool is on; the middle button pans too"],
  [
    <>
      <Kbd>⌘</Kbd> and scroll, or pinch
    </>,
    "Zoom at the pointer, 10% to 800%",
  ],
  [
    <>
      <Kbd>⇧ 1</Kbd> and <Kbd>⇧ 0</Kbd>
    </>,
    "Fit, and one image pixel per screen pixel",
  ],
  [
    "Arrow keys",
    <>
      Nudge 1 image pixel, 10 with <Kbd>⇧</Kbd>
    </>,
  ],
  [
    <>
      <Kbd>⇧</Kbd> while dragging
    </>,
    "Keep the box square, or its shape when resizing",
  ],
  [<Kbd key="e">Esc</Kbd>, "Cancel the drag, then clear the selection"],
];

/** Screen 24: every key the editor answers to, from the app bar on any page. */
export const Shortcuts = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      showCloseButton={false}
      className="grid max-w-[36rem] gap-6 border bg-card p-10 ring-0 sm:max-w-[36rem]"
    >
      <DialogTitle className="text-[1.728rem] leading-[1.05] font-medium tracking-[-0.04em]">
        Keyboard shortcuts
      </DialogTitle>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-ink-2">
            <th className="py-2 pr-4 font-normal">Keys</th>
            <th className="py-2 font-normal">Does</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([keys, does], i) => (
            <tr key={i} className="border-b border-rule-2">
              <td className="py-2.5 pr-4 whitespace-nowrap">{keys}</td>
              <td className="py-2.5 text-ink-2">{does}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <DialogClose asChild>
          <Button variant="outline" size="control">
            Close
          </Button>
        </DialogClose>
      </div>
    </DialogContent>
  </Dialog>
);
