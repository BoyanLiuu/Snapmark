"use client";

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * What a control does, on hover and on focus. The toolbar is icons, so without this only its
 * screen-reader name says; the native `title` the design file uses is slow and skips the keyboard.
 */
export const Hint = ({
  text,
  side = "bottom",
  children,
}: {
  text: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** One element, which takes the trigger's props and ref. */
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side} sideOffset={6}>
      {text}
    </TooltipContent>
  </Tooltip>
);
