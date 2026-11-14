"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Button } from "@/components/ui/button";
import type { Zoom } from "@/geom/camera";
import { hitTest } from "@/geom/hit";
import { toImage } from "@/geom/matrix";
import { CURSOR, handleAt, handlesOf } from "@/geom/handles";
import {
  IDLE,
  move,
  press,
  preview,
  release,
  type DrawTool,
  type Effect,
  type Gesture,
  type PointerAt,
  type ToolId,
} from "@/interact/machine";
import { createStore, type Store } from "@/lib/store";
import { cn } from "@/lib/utils";
import { isTyping } from "@/lib/typing";
import { useRefValue } from "@/lib/use-ref-value";
import { outline } from "@/model/bbox";
import { tagOf } from "@/model/describe";
import type { LoadedImage } from "@/model/image";
import type { Annotation, Doc, Id, Point, Size } from "@/model/types";
import { drawImageLayer } from "@/render/image";
import { drawOverlay, drawSelection } from "@/render/overlay";
import { createView, type View, type ViewStats } from "@/render/view";
import { Kbd } from "./kbd";
import { RenderReadout, useDebug } from "./render-readout";
import { useCamera, type StageCamera } from "./use-camera";
import type { Notice } from "./use-copy";

const POINTER_OFF = "Pointer off";

/** Floor, not round: the pixel whose square contains the pointer. */
const cursorText = ({ x, y }: Point) =>
  `x\u00a0${Math.floor(x)} y\u00a0${Math.floor(y)}`;

const CursorReadout = ({ store }: { store: Store<string> }) => {
  const text = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <p
      aria-hidden
      data-testid="cursor-readout"
      className="min-w-[15ch] font-mono whitespace-nowrap text-muted-foreground tabular-nums"
    >
      {text}
    </p>
  );
};

/** Screen 08: the image's frame until its pixels arrive. */
const DecodingPlate = ({
  name,
  natural,
}: {
  name: string;
  natural: Size | null;
}) => (
  <div
    role="status"
    data-testid="decoding"
    className="absolute inset-0 z-10 grid place-content-center justify-items-center gap-3 p-10 text-center"
  >
    <span
      aria-hidden
      style={{ aspectRatio: natural ? `${natural.w} / ${natural.h}` : "3 / 2" }}
      className="block w-[min(60vw,720px)] max-w-full border border-dashed border-muted-foreground bg-card"
    />
    <p className="font-mono text-sm text-ink-2">
      Decoding {natural ? `${natural.w}\u00a0×\u00a0${natural.h}` : name}
    </p>
  </div>
);

/** Screen 10. The pointer passes through all but the button, so drawing works under it. */
const EmptyPlate = ({ onDrawBox }: { onDrawBox: () => void }) => (
  <div
    data-testid="nothing-drawn"
    className="pointer-events-none absolute bottom-10 left-1/2 z-10 grid w-[min(30rem,calc(100%-48px))] -translate-x-1/2 justify-items-center gap-2 border bg-background/80 p-10 text-center"
  >
    <h2 className="text-[1.44rem] leading-[1.05] font-medium tracking-[-0.04em]">
      Nothing drawn on this image yet
    </h2>
    <p className="text-sm text-ink-2">
      Drag across the picture with a tool. Rectangle is <Kbd>R</Kbd>.
    </p>
    <Button
      size="control"
      className="pointer-events-auto mt-2"
      onClick={onDrawBox}
    >
      Draw a box
    </Button>
  </div>
);

export interface StageActions {
  onSelect: (id: Id | null) => void;
  onDraw: (tool: DrawTool, from: Point, to: Point) => void;
  onMove: (id: Id, dx: number, dy: number) => void;
  onReshape: (id: Id, patch: Partial<Annotation>) => void;
  onDelete: () => void;
  onDrawBox: () => void;
}

/**
 * The stage: `base` and `overlay` canvases over the status strip. Pointer events go through the
 * interaction machine; while a gesture runs the base draws its preview, and the document changes
 * once, on pointer-up. Zoom and pan change only the camera, never the document (M11): the wheel
 * zooms at the pointer, Space-drag or the middle button pans, whatever the tool.
 */
export const CanvasStage = ({
  status,
  image,
  doc,
  decoding,
  tool,
  selected,
  draft,
  actions,
  zoom,
  scale,
  onZoomSettle,
  ref,
  children,
}: {
  status: Notice | null;
  /** Null, with `doc`, until the image has decoded. */
  image: Pick<LoadedImage, "bitmap" | "natural"> | null;
  doc: Doc | null;
  decoding: { name: string; natural: Size | null } | null;
  tool: ToolId;
  selected: Id | null;
  draft: (tool: DrawTool, from: Point, to: Point) => Annotation;
  actions: StageActions;
  /** Where the view starts: fitted, or the address's `?zoom=&at=`. */
  zoom: Zoom;
  /** The camera's scale, for the editor bar's readout, without re-rendering the editor. */
  scale: Store<number | null>;
  /** After zooming or panning stops, for the address. */
  onZoomSettle: (zoom: Zoom) => void;
  ref?: Ref<StageCamera>;
  /** Covers the stage, and takes the pointer from it (screen 11). */
  children?: ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View | null>(null);
  // Read during frames and pointer events, so a frame re-renders nothing.
  const pointerRef = useRef<Point | null>(null);
  const gestureRef = useRef<Gesture>(IDLE);
  const previewRef = useRef<Doc | null>(null);
  const imageRef = useRefValue(image);
  const docRef = useRefValue(doc);
  const toolRef = useRefValue(tool);
  const selectedRef = useRefValue(selected);
  const draftRef = useRefValue(draft);
  const actionsRef = useRefValue(actions);
  const panRef = useRef<Point | null>(null);
  const spaceRef = useRef(false);
  const { frameCamera, camera, setCamera } = useCamera({
    viewRef,
    imageRef,
    overlayRef,
    pointerRef,
    zoom,
    onSettle: onZoomSettle,
    ref,
  });
  const [cursor] = useState(() => createStore(POINTER_OFF));
  const [stats, setStats] = useState<ViewStats | null>(null);
  const debug = useDebug();
  const debugRef = useRefValue(debug);

  useEffect(() => {
    const container = containerRef.current;
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!container || !base || !overlay) return;
    const scene = () => previewRef.current ?? docRef.current;
    const view = createView({
      container,
      base,
      overlay,
      camera: (size) => frameCamera({ w: size.cssW, h: size.cssH }),
      drawBase: (ctx, frame) => {
        const current = imageRef.current;
        const shown = scene();
        if (current && shown) drawImageLayer(ctx, frame, shown, current.bitmap);
      },
      drawOverlay: (ctx, frame) => {
        drawOverlay(ctx, frame, pointerRef.current);
        const shown = scene();
        const id = selectedRef.current;
        const a =
          id && shown?.order.includes(id) ? shown.byId.get(id) : undefined;
        if (a)
          drawSelection(ctx, frame, {
            box: a.kind === "arrow" ? null : outline(a),
            handles: handlesOf(a).map(([, p]) => p),
            tag: tagOf(a),
          });
      },
      // React only hears about frames when the debug readout is showing.
      onFrame: (next) => {
        container.dataset.frames = String(next.frames);
        container.dataset.baseDraws = String(next.baseDraws);
        container.dataset.overlayDraws = String(next.overlayDraws);
        if (imageRef.current) scale.set(next.camera.scale);
        if (debugRef.current) setStats(next);
      },
    });
    viewRef.current = view;
    return () => {
      view.dispose();
      viewRef.current = null;
    };
    // The view is made once; the refs carry every later value into its frames.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    viewRef.current?.invalidate();
  }, [image]);

  // A committed change has arrived: the preview that stood in for it can go.
  useEffect(() => {
    previewRef.current = null;
    viewRef.current?.invalidate();
  }, [doc]);

  useEffect(() => {
    viewRef.current?.invalidate("overlay");
  }, [selected]);

  useEffect(() => {
    // Draw one frame so the readout has numbers as soon as it appears.
    if (debug) viewRef.current?.invalidate("overlay");
  }, [debug]);

  const pointerAt = (
    event: PointerEvent<HTMLCanvasElement>,
  ): PointerAt | null => {
    const view = viewRef.current;
    if (!view) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    return {
      screen,
      image: toImage(view.camera(), screen),
      shift: event.shiftKey,
    };
  };

  const apply = (effects: Effect[]) => {
    const act = actionsRef.current;
    for (const effect of effects) {
      if (effect.kind === "select") act.onSelect(effect.id);
      else if (effect.kind === "draw")
        act.onDraw(effect.tool, effect.from, effect.to);
      else if (effect.kind === "reshape")
        act.onReshape(effect.id, effect.patch);
      else act.onMove(effect.id, effect.dx, effect.dy);
    }
  };

  const show = (gesture: Gesture) => {
    const shown = docRef.current;
    const next = shown ? preview(gesture, shown, draftRef.current) : null;
    const changed = next !== null || previewRef.current !== null;
    previewRef.current = next;
    if (changed) viewRef.current?.invalidate("base");
  };

  /** The selected shape's handle under the pointer, if it has handles. */
  const grabbed = (at: PointerAt) => {
    const id = selectedRef.current;
    const a = id ? docRef.current?.byId.get(id) : undefined;
    const view = viewRef.current;
    if (!a || !view) return undefined;
    const handle = handleAt(a, at.image, view.camera().scale);
    return handle ? { annotation: a, handle } : undefined;
  };

  const hitAt = (at: PointerAt) => {
    const shown = docRef.current;
    const view = viewRef.current;
    return shown && view ? hitTest(shown, at.image, view.camera().scale) : null;
  };

  const cursorFor = (at: PointerAt) => {
    if (panRef.current) return "grabbing";
    if (spaceRef.current) return "grab";
    const gesture = gestureRef.current;
    if (gesture.kind === "reshaping") return CURSOR[gesture.handle];
    if (gesture.kind === "moving") return "grabbing";
    if (gesture.kind === "drawing") return "crosshair";
    const grab = grabbed(at);
    if (grab) return CURSOR[grab.handle];
    if (toolRef.current === "rect" || toolRef.current === "arrow")
      return "crosshair";
    return hitAt(at) ? "move" : "default";
  };

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    const at = pointerAt(event);
    if (!at || !docRef.current || !imageRef.current) return;
    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = at.screen;
      event.currentTarget.style.cursor = "grabbing";
      return;
    }
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const grab = grabbed(at);
    const hit = grab ? null : hitAt(at);
    const [gesture, effects] = press(toolRef.current, hit, at, grab);
    gestureRef.current = gesture;
    apply(effects);
  };

  const track = (event: PointerEvent<HTMLCanvasElement>) => {
    const at = pointerAt(event);
    if (!at) return;
    pointerRef.current = at.screen;
    if (imageRef.current) cursor.set(cursorText(at.image));
    const panFrom = panRef.current;
    const cam = camera();
    if (panFrom && cam) {
      panRef.current = at.screen;
      setCamera({
        ...cam,
        tx: cam.tx + at.screen.x - panFrom.x,
        ty: cam.ty + at.screen.y - panFrom.y,
      });
      return;
    }
    const gesture = move(gestureRef.current, at);
    if (gesture !== gestureRef.current) {
      gestureRef.current = gesture;
      show(gesture);
    }
    event.currentTarget.style.cursor = cursorFor(at);
    viewRef.current?.invalidate("overlay");
  };

  const up = (event: PointerEvent<HTMLCanvasElement>) => {
    if (panRef.current) {
      panRef.current = null;
      event.currentTarget.style.cursor = spaceRef.current ? "grab" : "";
      return;
    }
    const at = pointerAt(event);
    const gesture = gestureRef.current;
    gestureRef.current = IDLE;
    if (!at || gesture.kind === "idle") return;
    const effects = release(gesture, at);
    // A change keeps its preview until the new document arrives, so nothing flickers.
    if (!effects.some((e) => e.kind !== "select")) show(IDLE);
    apply(effects);
  };

  const cancel = () => {
    panRef.current = null;
    gestureRef.current = IDLE;
    show(IDLE);
    viewRef.current?.invalidate("overlay");
  };

  const leave = () => {
    pointerRef.current = null;
    cursor.set(POINTER_OFF);
    viewRef.current?.invalidate("overlay");
  };

  // Esc drops a gesture in progress, or else the selection; Delete and Backspace remove it.
  // Space held over the picture pans; anywhere else it presses whatever has focus.
  useEffect(() => {
    const space = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      const down = event.type === "keydown";
      if (down && (isTyping(event.target) || !pointerRef.current)) return;
      if (!down && !spaceRef.current) return;
      event.preventDefault();
      spaceRef.current = down;
      if (overlayRef.current && !panRef.current)
        overlayRef.current.style.cursor = down ? "grab" : "";
    };
    window.addEventListener("keydown", space);
    window.addEventListener("keyup", space);
    const key = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.key === "Escape") {
        if (gestureRef.current.kind !== "idle") cancel();
        else actionsRef.current.onSelect(null);
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedRef.current &&
        gestureRef.current.kind === "idle"
      ) {
        event.preventDefault();
        actionsRef.current.onDelete();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keydown", space);
      window.removeEventListener("keyup", space);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-paper-3">
      <div
        ref={containerRef}
        data-testid="stage"
        className="relative min-h-0 overflow-hidden"
      >
        <canvas
          ref={baseRef}
          data-layer="base"
          role="img"
          aria-label="Drawing surface"
          className="pointer-events-none absolute top-0 left-0"
        />
        <canvas
          ref={overlayRef}
          data-layer="overlay"
          aria-hidden
          className="absolute top-0 left-0 touch-none"
          onPointerDown={down}
          onPointerMove={track}
          onPointerUp={up}
          onPointerCancel={cancel}
          onPointerLeave={leave}
        />
        {decoding && <DecodingPlate {...decoding} />}
        {image && doc && doc.order.length === 0 && !children && (
          <EmptyPlate onDrawBox={actions.onDrawBox} />
        )}
        {children}
      </div>

      <div
        data-testid="status-strip"
        className="relative flex min-h-[41px] items-center gap-6 overflow-hidden border-t bg-background px-4 py-1 text-sm"
      >
        <CursorReadout store={cursor} />
        <p
          role="status"
          className={cn(
            "min-w-0 truncate text-ink-2",
            status?.error && "text-destructive",
          )}
        >
          {status?.text}
        </p>
        {debug && <RenderReadout stats={stats} />}
      </div>
    </div>
  );
};
