"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Button } from "@/components/ui/button";
import { pinched, type Zoom } from "@/geom/camera";
import { toImage, type Camera } from "@/geom/matrix";
import {
  boxHandles,
  CURSOR,
  groupHandleAt,
  handleAt,
  handlesOf,
} from "@/geom/handles";
import { hitTest, TOUCH_SLOP, touching } from "@/geom/hit";
import {
  between,
  IDLE,
  isDrawTool,
  type Change,
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
import { extentOf, outline, union, type Box } from "@/model/bbox";
import { tagOf } from "@/model/describe";
import { sizeText } from "@/lib/text";
import { annotations, inOrder } from "@/model/doc";
import type { LoadedImage } from "@/model/image";
import type { Annotation, Doc, Id, Point, Size, TextA } from "@/model/types";
import { drawImageLayer } from "@/render/image";
import {
  drawGutter,
  drawMarquee,
  drawMember,
  drawOverlay,
  drawSelection,
} from "@/render/overlay";
import { createView, type View, type ViewStats } from "@/render/view";
import { Kbd } from "./kbd";
import { RenderReadout, useDebug } from "./render-readout";
import { placeTextEditor, TextEditor } from "./text-editor";
import { useCamera, type StageCamera } from "./use-camera";
import type { Notice } from "./use-copy";

const POINTER_OFF = "Pointer off";

/** How much further than a mouse a press reaches: a finger is less exact. */
const slopOf = (at: PointerAt) => (at.touch ? TOUCH_SLOP : 1);

/** A group's tag: the size of the box around it, in image px. */
const sizeOf = (box: Box) =>
  sizeText({ w: Math.round(box.w), h: Math.round(box.h) });

/** Floor, not round: the pixel whose square contains the pointer. */
const cursorText = ({ x, y }: Point) =>
  `x\u00a0${Math.floor(x)} y\u00a0${Math.floor(y)}`;

const CursorReadout = ({ store }: { store: Store<string> }) => {
  const text = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <p
      aria-hidden
      data-testid="cursor-readout"
      className="min-w-[15ch] font-mono whitespace-nowrap text-muted-foreground tabular-nums max-[40rem]:hidden"
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

export interface Writing {
  annotation: TextA;
  onDone: (text: string | null) => void;
}

export interface StageActions {
  onSelect: (ids: Id[]) => void;
  onDraw: (tool: DrawTool, from: Point, to: Point) => void;
  onMove: (ids: Id[], dx: number, dy: number) => void;
  onReshape: (changes: Change[]) => void;
  onDelete: () => void;
  onDrawBox: () => void;
  /** The text tool pressed on empty ground. */
  onWrite: (at: Point) => void;
  /** A label double-clicked. */
  onEditText: (id: Id) => void;
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
  selection,
  draft,
  actions,
  zoom,
  scale,
  onZoomSettle,
  writing,
  ref,
  cover,
  children,
}: {
  status: Notice | null;
  /** Null, with `doc`, until the image has decoded. */
  image: Pick<LoadedImage, "bitmap" | "natural"> | null;
  doc: Doc | null;
  decoding: { name: string; natural: Size | null } | null;
  tool: ToolId;
  selection: readonly Id[];
  draft: (tool: DrawTool, from: Point, to: Point) => Annotation;
  actions: StageActions;
  /** Where the view starts: fitted, or the address's `?zoom=&at=`. */
  zoom: Zoom;
  /** The camera's scale, for the editor bar's readout, without re-rendering the editor. */
  scale: Store<number | null>;
  /** After zooming or panning stops, for the address. */
  onZoomSettle: (zoom: Zoom) => void;
  /** The label being edited, over the canvas, or null. */
  writing: Writing | null;
  ref?: Ref<StageCamera>;
  /** Covers the stage, and takes the pointer from it (screen 11). */
  cover?: ReactNode;
  /** Shown over the stage, not taking the pointer from it: the out-of-bounds badge (M17). */
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
  const selectionRef = useRefValue(selection);
  const selected = (shown: Doc) => inOrder(shown, selectionRef.current);
  const draftRef = useRefValue(draft);
  const actionsRef = useRefValue(actions);
  const panRef = useRef<Point | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const writingRef = useRefValue(writing);
  const spaceRef = useRef(false);
  const extent = () => {
    const natural = imageRef.current?.natural;
    const shown = docRef.current;
    return natural && shown
      ? extentOf(annotations(shown), natural.w, natural.h)
      : null;
  };
  const { frameCamera, camera, setCamera, measure } = useCamera({
    viewRef,
    imageRef,
    overlayRef,
    pointerRef,
    extentOf: extent,
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
        const shown = scene();
        if (imageRef.current) drawGutter(ctx, frame, imageRef.current.natural);
        drawOverlay(ctx, frame, pointerRef.current);
        if (!shown) return;
        const gesture = gestureRef.current;
        if (gesture.kind === "marquee") {
          const box = between(gesture.from, gesture.to);
          drawMarquee(ctx, frame, box);
          // What the marquee would select, as the members of a selection are drawn.
          for (const id of touching(shown, box))
            drawMember(ctx, frame, outline(shown.byId.get(id)!));
          return;
        }
        const members = selected(shown);
        if (members.length === 1) {
          const [a] = members;
          drawSelection(ctx, frame, {
            box: a.kind === "arrow" ? null : outline(a),
            handles: handlesOf(a).map(([, p]) => p),
            tag: tagOf(a),
          });
        } else if (members.length > 1) {
          const box = union(members.map(outline));
          for (const a of members) drawMember(ctx, frame, outline(a));
          drawSelection(ctx, frame, {
            box,
            handles: boxHandles(box).map(([, p]) => p),
            tag: sizeOf(box),
          });
        }
      },
      // React only hears about frames when the debug readout is showing.
      onFrame: (next) => {
        container.dataset.frames = String(next.frames);
        container.dataset.baseDraws = String(next.baseDraws);
        container.dataset.overlayDraws = String(next.overlayDraws);
        if (imageRef.current) scale.set(next.camera.scale);
        const text = writingRef.current?.annotation;
        if (textRef.current && text)
          placeTextEditor(textRef.current, text, next.camera);
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

  // The image has arrived, with its document: Fit takes in what is drawn past its edge.
  const opened = Boolean(image && doc);
  useEffect(() => {
    measure();
    viewRef.current?.invalidate();
    // measure reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, opened]);

  // A committed change has arrived: the preview that stood in for it can go.
  useEffect(() => {
    previewRef.current = null;
    viewRef.current?.invalidate();
  }, [doc]);

  // A new selection, or a label opened for editing: the next frame draws it, and places the editor.
  const writingText = writing?.annotation;
  useEffect(() => {
    viewRef.current?.invalidate("overlay");
  }, [selection, writingText]);

  useEffect(() => {
    // Draw one frame so the readout has numbers as soon as it appears.
    if (debug) viewRef.current?.invalidate("overlay");
  }, [debug]);

  const pointerAt = (
    event: MouseEvent<HTMLCanvasElement>,
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
      touch: "pointerType" in event && event.pointerType === "touch",
    };
  };

  /** Keeps a drag's events coming past the canvas's edge; a synthetic pointer can't be captured. */
  const capture = (event: PointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Nothing to capture.
    }
  };

  // The fingers on the stage, and a pinch once there are two of them.
  const touchesRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ a: Point; b: Point; camera: Camera } | null>(null);

  const startPinch = () => {
    const [a, b] = [...touchesRef.current.values()];
    const cam = camera();
    if (!cam) return;
    gestureRef.current = IDLE;
    panRef.current = null;
    show(IDLE);
    pinchRef.current = { a, b, camera: cam };
  };

  const pinchTo = () => {
    const pinch = pinchRef.current;
    const [a, b] = [...touchesRef.current.values()];
    if (pinch && a && b)
      setCamera(pinched(pinch.camera, [pinch.a, pinch.b], [a, b]));
  };

  const apply = (effects: Effect[]) => {
    const act = actionsRef.current;
    for (const effect of effects) {
      if (effect.kind === "select") act.onSelect(effect.ids);
      else if (effect.kind === "draw")
        act.onDraw(effect.tool, effect.from, effect.to);
      else if (effect.kind === "reshape") act.onReshape(effect.changes);
      else if (effect.kind === "write") act.onWrite(effect.at);
      else if (effect.kind === "marquee") {
        const shown = docRef.current;
        if (shown)
          act.onSelect([
            ...new Set([...effect.base, ...touching(shown, effect.box)]),
          ]);
      } else act.onMove(effect.ids, effect.dx, effect.dy);
    }
  };

  const show = (gesture: Gesture) => {
    const shown = docRef.current;
    const next = shown ? preview(gesture, shown, draftRef.current) : null;
    const changed = next !== null || previewRef.current !== null;
    previewRef.current = next;
    if (changed) viewRef.current?.invalidate("base");
  };

  /** The selection's handle under the pointer: one shape's own, or a group's box. */
  const grabbed = (at: PointerAt) => {
    const shown = docRef.current;
    const view = viewRef.current;
    if (!shown || !view) return undefined;
    const members = selected(shown);
    const scale = view.camera().scale;
    const slop = slopOf(at);
    if (members.length === 1) {
      const handle = handleAt(members[0], at.image, scale, slop);
      return handle ? { start: members, box: null, handle } : undefined;
    }
    if (members.length === 0) return undefined;
    const box = union(members.map(outline));
    const handle = groupHandleAt(box, at.image, scale, slop);
    return handle ? { start: members, box, handle } : undefined;
  };

  const hitAt = (at: PointerAt) => {
    const shown = docRef.current;
    const view = viewRef.current;
    return shown && view
      ? hitTest(shown, at.image, view.camera().scale, slopOf(at))
      : null;
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
    if (isDrawTool(toolRef.current)) return "crosshair";
    return hitAt(at) ? "move" : "default";
  };

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    const at = pointerAt(event);
    if (!at || !docRef.current || !imageRef.current) return;
    // A press while a label is open commits it, and does nothing else.
    if (writingRef.current) {
      event.preventDefault();
      textRef.current?.blur();
      return;
    }
    if (at.touch) {
      touchesRef.current.set(event.pointerId, at.screen);
      if (touchesRef.current.size === 2) {
        capture(event);
        startPinch();
        return;
      }
    }
    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      event.preventDefault();
      capture(event);
      panRef.current = at.screen;
      event.currentTarget.style.cursor = "grabbing";
      return;
    }
    if (event.button !== 0) return;
    capture(event);
    const grab = grabbed(at);
    const hit = grab ? null : hitAt(at);
    // One finger on empty ground with the select tool pans: a marquee is for a mouse.
    if (at.touch && !grab && !hit && toolRef.current === "select") {
      panRef.current = at.screen;
      return;
    }
    const [gesture, effects] = press(
      toolRef.current,
      hit,
      at,
      selectionRef.current,
      grab,
    );
    gestureRef.current = gesture;
    apply(effects);
  };

  const track = (event: PointerEvent<HTMLCanvasElement>) => {
    const at = pointerAt(event);
    if (!at) return;
    if (at.touch && touchesRef.current.has(event.pointerId)) {
      touchesRef.current.set(event.pointerId, at.screen);
      if (pinchRef.current) {
        pinchTo();
        return;
      }
    }
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
    touchesRef.current.delete(event.pointerId);
    if (pinchRef.current) {
      // The pinch ends with its first finger; the other does nothing until it lifts too.
      if (touchesRef.current.size === 0) pinchRef.current = null;
      return;
    }
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

  const doubleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const at = pointerAt(event);
    const hit = at ? hitAt(at) : null;
    if (hit && docRef.current?.byId.get(hit)?.kind === "text")
      actionsRef.current.onEditText(hit);
  };

  const cancel = () => {
    touchesRef.current.clear();
    pinchRef.current = null;
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
        else actionsRef.current.onSelect([]);
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectionRef.current.length > 0 &&
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
          onDoubleClick={doubleClick}
          // A press on the picture never moves focus, so a label editor it opens keeps it.
          onMouseDown={(event) => event.preventDefault()}
        />
        {decoding && <DecodingPlate {...decoding} />}
        {image && doc && doc.order.length === 0 && !cover && (
          <EmptyPlate onDrawBox={actions.onDrawBox} />
        )}
        {writing && (
          <TextEditor
            key={writing.annotation.id}
            ref={textRef}
            annotation={writing.annotation}
            onDone={writing.onDone}
          />
        )}
        {children}
        {cover}
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
