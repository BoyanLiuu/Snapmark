# Architecture — Image Annotation Tool

> Project 21 · Frontend · 1–2 weeks · ~20 h/week
> Read `IMPLEMENTATION_PLAN.md` for scope tiers and build order.

## 1. The core problem

A user opens a 3840×2160 screenshot. The editor fits it into a 1012×740 viewport, so it displays at 26%. They zoom to 400% to box a one-pixel table border, draw a rectangle, zoom back out, and click **Export**. The exported PNG must be 3840×2160 and the rectangle must land on the same image pixels they boxed — not 26% of the way there, not twice as far across on a Retina display.

Loading a file, listing annotations, and deleting one are CRUD; they will take an afternoon and are not discussed further. The hard thing is that there are **three coordinate spaces** and every feature touches at least two of them:

| Space      | Unit                                                                      | Where it comes from         | Where it is used                                                     |
| ---------- | ------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| **Screen** | CSS px relative to the canvas's `getBoundingClientRect()`                 | `PointerEvent.clientX/Y`    | hit-test input, handle sizes, drag thresholds, the text-edit overlay |
| **Device** | physical px in the canvas backing store                                   | screen × `devicePixelRatio` | `canvas.width`, `ctx.setTransform` for the view                      |
| **Image**  | the source bitmap's natural pixel grid (`naturalWidth` × `naturalHeight`) | `createImageBitmap`         | **every stored number**                                              |

**The invariant that drives the whole design: annotation geometry is stored only in image space, as unrounded floats.** Nothing in the document model knows the zoom, the viewport size, or the device pixel ratio. Export is then not a conversion problem — it is the same scene drawn with the camera set to identity.

**This is the single most important decision in the project.** If geometry is stored in view space instead (the obvious thing to do, because that is what the pointer hands you), every export is correct only at the zoom level the annotation was drawn at, and the fix is not local: it requires a migration of every saved document plus a rewrite of every hit test, every resize handler, and every draw function. The three spaces must be separated on day one, in one module, with a unit test, before any tool code exists.

A second-order rule follows from the first and is just as easy to get wrong:

> **Geometry in image space, affordances in screen space.**

A resize handle is 8 CSS px whether you are at 10% or 800%. The click-vs-drag threshold is 3 CSS px. The hit-test tolerance is 6 CSS px. All three are _converted into_ image px at the moment of use by dividing by the current scale — they are never stored. Store a handle size in image px and the handles become invisible at low zoom and enormous at high zoom; store a geometry value in screen px and the export is wrong.

## 2. Stack

| Concern        | Choice                                                                    | Why                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework      | **Next.js 16 + React 19 + TypeScript 5**, chrome built with **shadcn/ui** | Client-only. The editor is one statically prerendered page whose surface is a Client Component; there are no API routes and no server code, and adding one would be a different project. (Originally Vite 5 + React 18; see the plan's decisions log) |
| Rendering      | **Canvas 2D**, two stacked layers                                         | The stated learning goal. Also the only surface where "export exactly what you see" is a re-render rather than a rasterisation problem                                                                                                                |
| Transforms     | **`DOMMatrix`**                                                           | Native, has `invertSelf()` and `transformPoint()`, and the _same object_ can be fed to `ctx.setTransform()`. Hand-rolled 3×2 maths is 40 lines you then have to test                                                                                  |
| Image decode   | **`createImageBitmap(blob, { imageOrientation: 'from-image' })`**         | Pre-decoded, so `drawImage` is a blit rather than a decode; and it is the only one-line fix for EXIF-rotated phone photos                                                                                                                             |
| Export surface | **`OffscreenCanvas`**, falling back to a detached `<canvas>`              | Renders at natural size without ever being in the DOM, and is worker-ready if export of a 100 MP image starts janking                                                                                                                                 |
| Encoding       | **`canvas.toBlob()`**                                                     | See §6 — async, binary, and ~33% smaller than the base64 `toDataURL` produces                                                                                                                                                                         |
| Clipboard      | `navigator.clipboard.write([new ClipboardItem(…)])`                       | The actual product (see the business-logic insight in the plan). Note the Safari user-activation trap in §6                                                                                                                                           |
| Persistence    | **IndexedDB** via `idb` 8                                                 | Must store an image `Blob`. `localStorage` is strings only and caps at ~5 MB — a single screenshot blows it                                                                                                                                           |
| State          | **Zustand**                                                               | The document is a `Map`, mutated outside React. Zustand holds the UI-visible slice; putting 400 annotations in React state re-renders the tree on every pointer-move                                                                                  |
| Backend        | **none**                                                                  | Nothing leaves the browser. An annotator that uploads your screenshots to annotate them is a worse product, and a backend adds an entire deployment to a 1–2 week build                                                                               |

### Contested: roll the canvas work by hand, or use a library?

|                                                         | **Canvas 2D by hand (chosen)**                  | SVG + DOM elements                                                                   | Konva.js / Fabric.js                                                        |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Export at natural size                                  | One re-render with an identity transform. Exact | Must rasterise SVG → canvas; `foreignObject` and webfont embedding are a known swamp | `stage.toImage({ pixelRatio })` — works, but it is _their_ coordinate model |
| Hit testing                                             | You write ~80 lines                             | Free (`pointer-events`)                                                              | Free                                                                        |
| Resize handles                                          | You write the anchor maths                      | Free-ish                                                                             | Free (`Transformer`)                                                        |
| Teaches canvas, coordinate transforms, export rendering | **Yes — this is the project**                   | Partly                                                                               | No                                                                          |
| Time to a working demo                                  | 3 days                                          | 1 day                                                                                | 2 hours                                                                     |

**Verdict: by hand.** Konva finishes this product in two evenings and removes all three stated learning goals. Read Konva's `Transformer.ts` for the handle maths and Excalidraw's `resizeElements.ts` for the flip handling, then write your own.

**Why not SVG,** more specifically: SVG would make selection and hit testing free, but the export story collapses. Serialising an SVG that references a 8 MP raster plus text in a webfont, then rasterising it through an `<img>` and a canvas, reintroduces exactly the coordinate and font-loading bugs this architecture exists to prevent — and taints the canvas in some browsers.

## 3. Data model

```ts
type Id = string; // nanoid(8)

interface Base {
  id: Id;
  z: number; // paint order within its pass (see §5)
  color: string; // '#e8590c'
  strokeWidth: number; // IMAGE px
  opacity: number; // 0..1
  bbox?: Bbox; // CACHED, see below
}

interface RectA extends Base {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string | null;
  radius: number;
}
interface EllipseA extends Base {
  kind: "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string | null;
}
interface ArrowA extends Base {
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  headScale: number;
}
interface HighlightA extends Base {
  kind: "highlight";
  x: number;
  y: number;
  w: number;
  h: number;
} // multiply-blended
interface PenA extends Base {
  kind: "pen";
  points: number[];
} // flat [x,y,x,y,…]
interface TextA extends Base {
  kind: "text";
  x: number;
  y: number;
  width: number; // wrap width, IMAGE px
  text: string;
  fontSize: number; // IMAGE px
  align: "left" | "center";
  plate: boolean;
}
interface PixelateA extends Base {
  kind: "pixelate";
  x: number;
  y: number;
  w: number;
  h: number;
  block: number;
}

type Annotation =
  RectA | EllipseA | ArrowA | HighlightA | PenA | TextA | PixelateA;

interface Doc {
  imageHash: string; // SHA-256 of the source bytes — the primary key
  naturalWidth: number;
  naturalHeight: number;
  byId: Map<Id, Annotation>;
  order: Id[]; // z-order, bottom to top
}
```

Four decisions worth stating:

- **Every number above is image px, and they are floats.** Rounding geometry to integers on write looks tidy and is a bug: at 26% zoom one screen pixel is 3.8 image pixels, so rounding quantises every drag to a 4-pixel grid and the user cannot nudge. Round only for display in the inspector.
- **`strokeWidth` and `fontSize` are image px, not screen px.** This is the uncomfortable half of the invariant: a 2 px stroke on a 3840 px-wide screenshot is a hairline. The fix is a sensible _default_ derived from the image — `max(2, round(naturalWidth / 400))`, so 10 px on a 4K screenshot and 2 px on a 800 px thumbnail — not a change of units. If stroke width were stored in screen px, the exported line thickness would depend on the zoom at which it was drawn.
- **`bbox` is denormalised onto the annotation and invalidated on mutation.** Hit testing, marquee selection, and the out-of-bounds check all need it, and for `TextA` computing it requires a full `measureText` wrap pass. Recomputing that 60 times a second during a drag is the one thing in this app that will actually show up in a profile.
- **`order` is a separate array, not a sort on `z`.** Bring-forward is then an array splice instead of a renumber of every annotation. The same reason the whiteboard project (11) uses a `Y.Array`.

### Persistence

Two IndexedDB stores, both keyed by `imageHash = SHA-256(bytes)` via `crypto.subtle.digest`:

```
images:  { hash, blob, naturalWidth, naturalHeight, addedAt }
docs:    { hash, order, annotations[], updatedAt, schemaVersion }
```

Keying on a content hash rather than a filename means dropping the same screenshot again restores the annotations you already made on it, and renaming the file does not orphan them. Writes are debounced 400 ms; the image blob is written once.

## 4. The coordinate chain

One module, `geom/matrix.ts`, owns the entire chain. Nothing else in the codebase is permitted to multiply a coordinate by a scale.

```
                    camera (scale, tx, ty)            devicePixelRatio
  IMAGE space  ──────────── M ────────────►  SCREEN space ───────── ×dpr ────────►  DEVICE space
 (stored geometry)                        (CSS px in the canvas)              (the backing store)
       ▲                                         │
       └──────────────────── M⁻¹ ────────────────┘
                     (every pointer event)
```

```ts
// image px -> canvas CSS px
const M = new DOMMatrix().translateSelf(cam.tx, cam.ty).scaleSelf(cam.scale);
const Mi = DOMMatrix.fromMatrix(M).invertSelf();

const toScreen = (p: Point) => M.transformPoint(p); // for the text overlay, handles, labels
const toImage = (p: Point) => Mi.transformPoint(p); // for every pointer event

// the view canvas: fold dpr in here, and ONLY here
ctx.setTransform(
  dpr * cam.scale,
  0,
  0,
  dpr * cam.scale,
  dpr * cam.tx,
  dpr * cam.ty,
);
```

**The sharpest edge in the project is that these are two different matrices.** The transform handed to `ctx.setTransform` includes `dpr`; the one used to interpret pointer events must not, because `clientX` is already in CSS px. Use the device matrix for hit testing on a Retina display and every click lands at half the intended position — a bug that is invisible on an external 1× monitor and reproduces 100% on the laptop screen. Hence: `setTransform` is called in exactly one function, `render/view.ts`, and `M` is the only matrix exported.

Canvas sizing follows from the same rule:

```ts
canvas.width = Math.round(cssW * dpr);
canvas.style.width = cssW + "px";
canvas.height = Math.round(cssH * dpr);
canvas.style.height = cssH + "px";
```

### Fit and cursor-anchored zoom

```ts
function fit(nat: Size, view: Size): Camera {
  const scale = Math.min(view.w / nat.w, view.h / nat.h) * 0.95; // 5% breathing room
  return {
    scale,
    tx: (view.w - nat.w * scale) / 2,
    ty: (view.h - nat.h * scale) / 2,
  };
}

// keep the image point under the cursor exactly under the cursor
function zoomAt(cam: Camera, cursorScreen: Point, k: number): Camera {
  const p = toImage(cursorScreen); // BEFORE changing scale
  const scale = clamp(cam.scale * k, 0.1, 8);
  return {
    scale,
    tx: cursorScreen.x - p.x * scale,
    ty: cursorScreen.y - p.y * scale,
  };
}
```

Two decisions in the zoom behaviour:

- **"100%" means one image pixel per CSS pixel**, so a Retina screenshot at 100% appears half the physical size it was captured at. This confuses people, so the zoom bar reads `100% · 3840 × 2160` and offers both `Fit` and `1:1`.
- **`ctx.imageSmoothingEnabled = false` above 200%.** Boxing a 1 px border requires seeing the pixel grid. Bilinear smoothing at 400% turns a crisp screenshot into mush and makes precise annotation impossible. Below 200%, smoothing stays on or downscaled text aliases badly.

## 5. Rendering pipeline — two canvases, one scene function

```
┌─ overlay canvas ── redrawn every frame during an interaction ──────────────┐
│  selection outline · 8 resize handles · marquee · in-progress draft        │
│  crosshair guides · out-of-bounds gutter · remote-free, purely ephemeral   │
├─ base canvas ───── redrawn only when the doc or the camera changes ────────┤
│  pass 1: drawImage(bitmap, 0, 0)                                           │
│  pass 2: pixelate regions   (read-back + nearest-neighbour upscale)        │
│  pass 3: highlights         (globalCompositeOperation = 'multiply')        │
│  pass 4: rect / ellipse / arrow / pen / text  (source-over, in `order`)    │
└────────────────────────────────────────────────────────────────────────────┘
```

**Four passes, not one, because of `multiply`.** A highlight drawn with `source-over` and 35% alpha washes out the text underneath; drawn with `multiply` it behaves like a real marker and the text stays readable. But `multiply` composites against everything already on the canvas — so a highlight drawn after an arrow would darken the arrow. Putting all highlights in a pass of their own, before the opaque annotations, fixes it. Pleasant side effect: multiply is commutative, so z-order _within_ the highlight pass is genuinely irrelevant and need not be maintained.

`pixelate` must come before the highlights because it reads back pixels: `ctx.drawImage(src, sx,sy,sw,sh, 0,0, sw/block, sh/block)` into a scratch canvas, then draw that back up over the region with smoothing off. Read-back after annotations are drawn would pixelate the annotations too.

**No dirty rectangles.** Clearing a 1440×900 canvas, blitting a decoded `ImageBitmap`, and drawing 50 annotations costs ~3–5 ms. Dirty-rect bookkeeping would be premature here, and it is the thing most likely to produce smear artefacts. The two-canvas split is kept for a different reason: during a drag the overlay changes every frame while the base does not, and redrawing the base at 60 fps for the sake of eight handles is pure waste.

### The one scene function

```ts
export function drawScene(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  doc: Doc,
  bitmap: ImageBitmap,
  opts: { minVisualStroke: number }, // 1/cam.scale for the view, 0 for export
): void;
```

Both the view renderer and the exporter call this, with the same `doc`. **If the export path has its own drawing code the exported PNG will silently diverge from the preview**, and nobody notices until a user ships a screenshot with a misplaced arrow. One function, two callers, is the structural decision that makes "what you see is what you get" true by construction rather than by diligence.

`minVisualStroke` is the only legitimate difference between the two paths, and it is explicit for that reason. At 10% zoom a 4 px stroke renders as 0.4 device px and visually vanishes, so the view clamps `ctx.lineWidth = Math.max(sw, opts.minVisualStroke)`. The export passes `0`, because in a full-resolution PNG a 4 px stroke is 4 px and must not be fattened. Any _other_ screen-relative quantity appearing inside `drawScene` is a bug — that is the rule the review checklist should enforce.

## 6. Export rendering

```
Export ─► new OffscreenCanvas(naturalWidth, naturalHeight)
          ctx.setTransform(1, 0, 0, 1, 0, 0)        ← image space IS device space
          await document.fonts.ready                 ← before any measureText
          drawScene(ctx, doc, bitmap, { minVisualStroke: 0 })
          ─► canvas.convertToBlob({ type, quality })
             ├─ download:  URL.createObjectURL(blob) + <a download>
             └─ clipboard: navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
```

Five things that are easy to get wrong:

**1. Re-render; never scale the view canvas.** The tempting one-liner is to draw the 1012×569 view canvas into a 3840×2160 canvas. That upsamples a raster that was already downsampled: the photo comes back soft and every annotation edge is blurry and 3.8 px thick. Re-rendering from the model at natural size is the whole point of storing geometry in image space, and it costs one `drawImage` plus N annotation draws — about 25 ms for an 8 MP image with 40 annotations.

**2. `devicePixelRatio` is irrelevant to the export and must not appear in it.** The export target is the image's natural pixel grid, which has nothing to do with the user's monitor. Letting `dpr` leak in is how you get a 7680×4320 PNG from a 3840×2160 screenshot on a Retina laptop and a correct one on an external display — a bug report that reads as unreproducible.

**3. Zoom is irrelevant too, and proving it is the acceptance test.** Draw the same rectangle at 25% zoom and at 400% zoom, export both, and the two PNGs should be byte-identical. This is the only test that can catch a view-space value having leaked into stored geometry (see §Testing in the plan).

**4. `toBlob` / `convertToBlob`, not `toDataURL`.**

|                        | `toDataURL()`                                                            | `toBlob()` / `convertToBlob()`    |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| Blocks the main thread | yes — 200–600 ms encoding a 8 MP PNG, a visible freeze                   | no, callback/promise              |
| Output                 | base64 string, ~33% larger than the bytes                                | binary `Blob`                     |
| Very large canvases    | can exceed the engine's max string length and throw or return `"data:,"` | fine                              |
| Feeds the clipboard    | needs a decode back to binary                                            | `ClipboardItem` takes it directly |

**5. The clipboard has two traps.** It needs a secure context (`https` or `localhost`) and a user gesture — and in Safari the user activation does **not** survive an `await`. So do not await the blob and then write it; hand `ClipboardItem` the _promise_:

```ts
// WRONG in Safari: activation is gone by the time write() runs
const blob = await render();
await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

// RIGHT: synchronous from the click, the promise resolves later
navigator.clipboard.write([new ClipboardItem({ "image/png": renderToBlob() })]);
```

Also: only `image/png` is reliably accepted by `ClipboardItem` across browsers. JPEG export is download-only.

### Canvas size limits

Browsers cap canvas dimensions and total area, and they do it by throwing nothing — you get a blank or all-transparent canvas:

| Engine                | Max dimension                  | Max area        |
| --------------------- | ------------------------------ | --------------- |
| Chrome / Edge desktop | 65,535                         | 2²⁸ px ≈ 268 MP |
| Firefox               | 32,767                         | ~124 MP         |
| Safari desktop        | 16,384                         | ~268 MP         |
| Safari iOS            | 4,096–8,192 (device-dependent) | ~16–64 MP       |

So a 12000×9000 photo (108 MP) exports fine on desktop Chrome and silently produces an empty PNG on an iPad. The exporter therefore (a) probes by allocating and reading back one pixel, and (b) applies a 64 MP budget: above it, export downscales by `sqrt(budget / area)` and says so in the dialog with the resulting dimensions, rather than failing or lying. The _view_ always works from a bitmap downscaled to at most 2× the viewport, so display is never the bottleneck — only export deals in full resolution.

## 7. Geometry: arrows, hit testing, resize handles

### Arrowheads that stay correct at any length

The naive arrowhead offsets the head points by a fixed ±dx/±dy, which skews on diagonals; the next-naive version sizes the head from the stroke width alone, so a 30 px arrow is 90% head. Both are fixed by computing along the shaft angle and clamping the head against the shaft length:

```ts
const ang = Math.atan2(y2 - y1, x2 - x1);
const len = Math.hypot(x2 - x1, y2 - y1);
const head = clamp(len * 0.28, 4 * sw, 10 * sw); // image px; never longer than ~28% of the shaft
const SPREAD = Math.PI / 7; // 25.7°, constant at every length

const hx1 = x2 - head * Math.cos(ang - SPREAD),
  hy1 = y2 - head * Math.sin(ang - SPREAD);
const hx2 = x2 - head * Math.cos(ang + SPREAD),
  hy2 = y2 - head * Math.sin(ang + SPREAD);

// shorten the shaft so the round line cap does not poke out of the filled head
const bx = x2 - head * 0.8 * Math.cos(ang),
  by = y2 - head * 0.8 * Math.sin(ang);
```

Test it at `len = 3` (degenerate — the head must not invert or NaN), `len = 40`, and `len = 2000`. The `clamp` lower bound against `4 * sw` is what stops a thick short arrow becoming a blob.

Its bbox is **not** the two endpoints: inflate by `sw / 2 + head * sin(SPREAD)`, or the marquee will miss arrows it visibly crosses.

### Hit testing

A reverse-order scan over `order` — topmost first, return on the first hit. At 400 annotations this is ~0.1 ms and a spatial index would be ceremony.

```ts
const tol = 6 / cam.scale;        // 6 CSS px expressed in image px — recomputed, never stored

rect      : on the frame if |dist to any edge| <= tol + sw/2; inside only if fill !== null
ellipse   : |(dx/rx)² + (dy/ry)² − 1| small, scaled by tol; inside if filled
arrow/pen : min point-to-segment distance <= tol + sw/2
highlight : inside the rect (highlights are always "filled")
text      : inside the wrapped bbox (the plate rect when plate === true)
```

The `tol = 6 / cam.scale` line is the second-order rule from §1 in one expression: the user's finger is 6 screen pixels wide regardless of zoom.

### Resize handles

Eight handles, no rotation. Rotation is deliberately out of scope — it multiplies every hit test by an inverse-rotation step and is not what screenshot annotation needs.

```ts
function resize(
  start: Rect,
  handle: Handle,
  p: Point,
  keepAspect: boolean,
): Rect {
  let x = start.x,
    y = start.y,
    x2 = start.x + start.w,
    y2 = start.y + start.h;
  if (handle.includes("w")) x = p.x;
  if (handle.includes("e")) x2 = p.x;
  if (handle.includes("n")) y = p.y;
  if (handle.includes("s")) y2 = p.y;
  let w = x2 - x,
    h = y2 - y;
  if (w < 0) {
    x = x2;
    w = -w;
    flipH();
  } // dragged past the opposite edge
  if (h < 0) {
    y = y2;
    h = -h;
    flipV();
  }
  if (keepAspect) {
    /* grow the smaller axis to match start.w / start.h */
  }
  return { x, y, w, h };
}
```

The non-obvious part is `flipH()` / `flipV()`: when the rectangle inverts, **the handle you are dragging becomes the opposite handle**. Without mirroring the live handle identity, continuing the same drag past the flip point moves the box in the wrong direction and the cursor shape is wrong. This is the single fiddliest function in the project; write it with a test table before wiring it to a pointer.

Handle _rendering_ and handle _hit regions_ are both 8 CSS px on the overlay canvas, which is why they live in screen space and the overlay is drawn with an identity transform while the base canvas is drawn with `M`.

## 8. Text annotations on canvas

Canvas has no text layout engine. Three problems, three decisions:

**Measurement.** `ctx.measureText` is unaffected by the active transform — it reports in the units of `ctx.font`. So setting `ctx.font = \`${a.fontSize}px ${STACK}\``with`fontSize`in image px yields measurements in image px, which is exactly what the model wants. Height comes from`m.actualBoundingBoxAscent + m.actualBoundingBoxDescent`, falling back to `fontSize * 1.2` where those are missing. Measurement happens on a single shared offscreen context so the view and the export measure identically.

**Wrapping.** Greedy word wrap against `a.width`, with a memo cache keyed by `` `${font}|${text}` ``:

```ts
const cache = new Map<string, number>();
const widthOf = (ctx, s: string) => {
  const k = ctx.font + "|" + s;
  let v = cache.get(k);
  if (v === undefined) {
    v = ctx.measureText(s).width;
    cache.set(k, v);
  }
  return v;
};
```

A single `measureText` is only ~2–5 µs, but a 40-word paragraph re-wrapped every frame during a drag is ~10 k calls/second for no reason. The cache makes text annotations free to drag.

**Legibility.** Annotation text sits on arbitrary photos, so any fixed colour is unreadable against roughly half of them. Each text annotation optionally paints a **background plate**: a rounded rect at the wrapped bbox inflated by `fontSize * 0.35`, filled `rgba(0,0,0,0.72)` with white text (or the inverse). This is why the wrapped height must be _computed_ rather than estimated — the plate has to match the text it sits behind, at export resolution.

**Editing uses a DOM `<textarea>`, not an in-canvas caret.** Positioned with `toScreen`, sized `fontSize * cam.scale`, transparent background, and on blur it writes the string to the model and the canvas re-renders canonically. Implementing a caret, selection, double-click word select, and IME composition on a canvas is multiple weeks of work; Figma did it and wrote a long post about why it was hard. The honest cost of the overlay: the browser's own wrapping inside the textarea will not agree with `wrapText()` to the pixel, so the text can reflow slightly on commit. Mitigated by giving the textarea the identical font stack, `width: a.width * scale`, and matching `line-height`; accepted as a sub-pixel discrepancy that resolves the moment editing ends.

**Fonts must be loaded before any measurement.** If `measureText` runs against a fallback while a webfont is still loading, the preview wraps one way and the export wraps another. Two mitigations, both cheap: use a system font stack (no loading at all), and `await document.fonts.ready` before the export render regardless.

## 9. Interaction state machine and undo

A pile of booleans becomes unmaintainable at about the fourth tool. One explicit machine:

```
idle ─ down on a handle ──────────────────► resizing(anchor, liveHandle)
     ─ down on a selected/hit annotation ─► maybeDrag ─ moved > 3 CSS px ─► dragging
     │                                                └─ up before that ──► select (a click)
     ─ down on empty, tool = select ──────► marquee
     ─ down on empty, tool = rect|arrow|… ► drawing ─ up ─► commit + auto-select
     ─ space held, or middle button ──────► panning   (tool-independent, always available)
     ─ dblclick on a text annotation ─────► editing   (DOM overlay has focus; canvas ignores pointers)
     ─ Esc from any state ────────────────► idle, discarding the in-progress operation
```

The 3 px threshold is in **CSS px**, not image px: at 400% zoom a 3-image-px threshold would fire before the user has visibly moved, and at 10% it would swallow real drags. Same rule as §1.

During `dragging` / `resizing` / `drawing`, the model is **not** touched — the operation's result is rendered on the overlay and committed once on pointer-up. Here the reason is not network traffic (project 11's reason) but **undo granularity**: a drag that wrote on every pointer-move would produce 300 undo entries and ⌘Z would appear broken.

Undo is a bounded stack of operations, capped at 100 entries. Each entry holds only what one change touched:

```ts
type Change = {
  id: Id;
  before: Annotation | undefined; // undefined: the change added it
  after: Annotation | undefined; // undefined: the change removed it
};
type Entry = {
  label: string; // "Draw", "Move", "Resize", "Restyle", "Delete"
  changes: Change[];
  order: { before: Id[]; after: Id[] } | null; // only when the paint order moved
  group: string | null; // a slider drag merges into one entry until it is let go
};
```

The changed annotations rather than document snapshots, because a snapshot of every annotation ×100 entries is retained memory that grows with the document. Each of Snapmark's kinds is a few numbers and at most a string, so an entry keeps the touched annotations whole rather than diffing their properties.

## 10. Project layout

```
src/
  model/
    types.ts          # the annotation union. Comment at the top: ALL geometry is image space
    doc.ts            # Map<Id,Annotation> + order[]; the only place annotations are mutated
    bbox.ts           # per-kind bbox INCLUDING stroke, arrowhead spread, wrapped text, plate
    persist.ts        # IndexedDB; image blob + doc keyed by SHA-256 of the source bytes
  geom/
    matrix.ts         # DOMMatrix build/invert, toImage/toScreen. BUILD AND TEST THIS FIRST
    camera.ts         # fit(), zoomAt() cursor-anchored, pan, clamp, 1:1
    hit.ts            # reverse-order scan; tol = 6 / scale
    resize.ts         # handle anchors, negative-size flip + live-handle mirroring, shift-aspect
    arrow.ts          # head angle/length/clamp and the shaft shortening
  render/
    scene.ts          # drawScene() — THE shared function; view and export both call it
    draw/{rect,ellipse,arrow,highlight,pen,text,pixelate}.ts
    text-layout.ts    # measureText cache, greedy wrap, plate geometry
    view.ts           # two canvases, DPR sizing, the ONLY call to ctx.setTransform
    overlay.ts        # selection, 8 handles, marquee, draft, out-of-bounds gutter
  export/
    render.ts         # OffscreenCanvas at natural size, identity transform, fonts.ready
    encode.ts         # convertToBlob, PNG vs JPEG, 64 MP budget + downscale notice
    clipboard.ts      # ClipboardItem given a blob PROMISE (Safari activation)
    limits.ts         # per-engine canvas caps + the 1px allocation probe
  interact/
    machine.ts        # the state machine above; 3 CSS px threshold
    tools/{select,rect,ellipse,arrow,highlight,pen,text,pixelate}.ts
    text-overlay.ts   # the positioned <textarea>
  history/
    undo.ts           # undo by operation: what each change touched, 100 entries
  components/         # §10's `ui/` in the Next.js build
    ui/               # shadcn primitives (button, …)
    editor/           # canvas-stage.tsx, then toolbar, inspector, layer-list, export-dialog, zoom-bar, dropzone
  app/                # Next.js: layout.tsx, page.tsx, globals.css
```

## 11. Failure modes

| Failure                                                                 | Behaviour                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12000×9000 (108 MP) image exported on iPad Safari                       | Allocation probe fails the 64 MP budget; export downscales by `sqrt(64/108)` and the dialog states the real output size. Never a blank PNG                                                   |
| EXIF-rotated phone photo                                                | `createImageBitmap(blob, { imageOrientation: 'from-image' })` normalises at decode, so image space matches what the user sees. Without it, every annotation lands rotated 90° in the export  |
| HEIC / AVIF / TIFF upload                                               | `createImageBitmap` rejects; the dropzone reports the codec and asks for PNG/JPEG/WebP rather than showing an empty canvas                                                                   |
| Image loaded from a cross-origin URL without CORS (P2)                  | Canvas is tainted and `convertToBlob` throws `SecurityError`. Detected at load with a 1 px `getImageData` probe; export is disabled with the reason shown, not left to fail at the last step |
| `navigator.clipboard.write` unsupported, or the page is on plain `http` | Copy button is replaced by Download, with a one-line explanation. It never silently no-ops                                                                                                   |
| Annotation dragged outside the image bounds                             | The view shows a dimmed out-of-bounds gutter and a badge; the export canvas is exactly the natural size, so the part outside is clipped. Surfacing it beforehand is the whole point          |
| A webfont is still loading when export runs                             | `await document.fonts.ready` first; otherwise the export wraps text differently from the preview and nobody can explain why                                                                  |
| Zoomed to 800% and dragging                                             | Geometry is float, so no quantisation. The overlay clear region is inflated by `sw/2 + handle size` or handles leave trails                                                                  |
| 1,500 annotations                                                       | Full base redraw ~18 ms. The `measureText` cache matters more than the draw calls; a soft warning past 800 and layer-list virtualisation                                                     |
| Tab refreshed or crashed mid-session                                    | IndexedDB restores the doc by image hash on next load; the debounced write means at most 400 ms of edits are lost                                                                            |
| Degenerate arrow (pointer-down and up in the same place)                | `len < 2 * sw` is discarded on commit rather than stored as a zero-length arrow that cannot be selected or resized                                                                           |
