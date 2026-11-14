import type { Size } from "@/model/types";

/** Spaces that never break, so "3840 × 2407 px" stays on one line. */
export const nbsp = (s: string) => s.replaceAll(" ", " ");

/** "3840 × 2407", unbreakable. */
export const sizeText = ({ w, h }: Size) => nbsp(`${w} × ${h}`);
