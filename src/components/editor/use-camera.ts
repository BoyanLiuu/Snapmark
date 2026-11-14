"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
  type RefObject,
} from "react";
import { cameraFor, zoomAt, zoomOf, type Zoom } from "@/geom/camera";
import type { Camera } from "@/geom/matrix";
import type { Box } from "@/model/bbox";
import { debounced } from "@/lib/debounce";
import { useRefValue } from "@/lib/use-ref-value";
import type { LoadedImage } from "@/model/image";
import type { Point, Size } from "@/model/types";
import type { View } from "@/render/view";

/** The zoom buttons' way in: Fit, 1:1, and steps about the view's centre. */
export interface StageCamera {
  zoomBy: (k: number) => void;
  fit: () => void;
  actualSize: () => void;
}

const SETTLE_DELAY = 200;
/** One step of the zoom buttons and of + and −. */
export const ZOOM_STEP = 1.25;
/** Zoom per unit of wheel delta: a pinch's deltas are small, a wheel notch's large. */
const PINCH_RATE = 0.01;
const WHEEL_RATE = 0.0015;

/**
 * Pinch arrives as a wheel with Ctrl held, and a mouse wheel in lines or whole notches; anything
 * else is a trackpad's two fingers, which pan.
 */
const wheelZooms = (event: WheelEvent) =>
  event.ctrlKey ||
  event.metaKey ||
  event.deltaMode === 1 ||
  (event.deltaX === 0 &&
    Math.abs(event.deltaY) >= 50 &&
    Number.isInteger(event.deltaY));

/**
 * The stage's camera (M11): fitted until changed, then a scale and the image point at the view's
 * centre. It lives in a ref the view reads each frame, so zooming and panning re-render nothing;
 * the address hears of it once it settles. The wheel zooms at the pointer, or pans on a trackpad.
 */
export const useCamera = ({
  viewRef,
  imageRef,
  overlayRef,
  pointerRef,
  extentOf,
  zoom,
  onSettle,
  ref,
}: {
  viewRef: RefObject<View | null>;
  imageRef: RefObject<Pick<LoadedImage, "natural"> | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  pointerRef: RefObject<Point | null>;
  /** The image and what is drawn past its edge, for Fit; null when nothing is. */
  extentOf: () => Box | null;
  zoom: Zoom;
  onSettle: (zoom: Zoom) => void;
  ref?: Ref<StageCamera>;
}) => {
  const zoomRef = useRef(zoom);
  // Measured when the image opens and when Fit is pressed, not as things are drawn, so the view
  // never jumps under the pointer.
  const extentRef = useRef<Box | null>(null);
  const extentOfRef = useRefValue(extentOf);
  const onSettleRef = useRefValue(onSettle);
  const settleRef = useRef<ReturnType<typeof debounced<Zoom>>>(null);

  const viewSize = (): Size => {
    const size = viewRef.current?.size();
    return { w: size?.cssW ?? 0, h: size?.cssH ?? 0 };
  };

  /** The camera for a frame of this size; until the image arrives, nothing to frame. */
  const frameCamera = (size: Size): Camera => {
    const image = imageRef.current;
    return image
      ? cameraFor(
          zoomRef.current,
          image.natural,
          size,
          extentRef.current ?? undefined,
        )
      : { scale: 1, tx: 0, ty: 0 };
  };

  /** The camera as it stands now, which may be ahead of the last frame's. */
  const camera = (): Camera | null =>
    imageRef.current ? frameCamera(viewSize()) : null;

  const setZoom = (next: Zoom) => {
    zoomRef.current = next;
    settleRef.current ??= debounced(
      (settled: Zoom) => onSettleRef.current(settled),
      SETTLE_DELAY,
    );
    settleRef.current.schedule(next);
    viewRef.current?.invalidate();
  };

  /** Takes in what is drawn past the image's edge: as the image opens, and on Fit. */
  const measure = () => {
    extentRef.current = extentOfRef.current();
  };

  const setCamera = (next: Camera) => setZoom(zoomOf(next, viewSize()));

  const zoomAtCentre = (k: (cam: Camera) => number) => {
    const cam = camera();
    const { w, h } = viewSize();
    if (cam) setCamera(zoomAt(cam, { x: w / 2, y: h / 2 }, k(cam)));
  };

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (k) => zoomAtCentre(() => k),
      fit: () => {
        measure();
        setZoom("fit");
      },
      actualSize: () => zoomAtCentre((cam) => 1 / cam.scale),
    }),
    // Every value it reads is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // React's wheel listener is passive; this one has to stop the page from scrolling.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const wheel = (event: WheelEvent) => {
      const cam = camera();
      if (!cam) return;
      event.preventDefault();
      if (!wheelZooms(event)) {
        setCamera({
          ...cam,
          tx: cam.tx - event.deltaX,
          ty: cam.ty - event.deltaY,
        });
        return;
      }
      // The last pointer position, not the wheel's: browsers round a wheel's to whole pixels, and
      // the pixel kept under the pointer must be the one the readout names.
      const rect = overlay.getBoundingClientRect();
      const at = pointerRef.current ?? {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const rate = event.ctrlKey ? PINCH_RATE : WHEEL_RATE;
      setCamera(zoomAt(cam, at, Math.exp(-event.deltaY * rate)));
    };
    overlay.addEventListener("wheel", wheel, { passive: false });
    return () => overlay.removeEventListener("wheel", wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { frameCamera, camera, setCamera, measure };
};
