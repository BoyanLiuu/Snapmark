import type { Size } from "@/model/types";
import type { Camera } from "./matrix";

/** A fitted image fills 95% of its limiting axis, leaving breathing room around it. */
const BREATHING = 0.95;

/** The camera that shows the whole image, centred in the view. Zoom and pan arrive in M11. */
export const fit = (nat: Size, view: Size): Camera => {
  const scale = Math.min(view.w / nat.w, view.h / nat.h) * BREATHING;
  return {
    scale,
    tx: (view.w - nat.w * scale) / 2,
    ty: (view.h - nat.h * scale) / 2,
  };
};
