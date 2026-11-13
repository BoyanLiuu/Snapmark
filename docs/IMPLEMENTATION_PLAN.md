# Implementation Plan — Image Annotation Tool

> Project 21 · Frontend · 1–2 weeks for M0–M8, 3–4 weeks for all of it (~20 h/week) · Learning goals: canvas, coordinate transforms, export rendering
> Structured as milestones. Each one is a vertical slice with a check you run and a commit you make.
> Screens referenced as `NN` are the numbered captures in `hallmark/flow.html`, which is the design file this plan builds to. The design file is not in this repo yet; until it is, screen numbers and `hallmark/…` paths refer to it.
> Progress is tracked in [`MILESTONES.md`](../MILESTONES.md); stack changes from the original plan are in the [decisions log](#decisions-log) at the end.

## Reference products

| Product                                                   | What to take from it                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CleanShot X** (cleanshot.com, macOS, paid)              | The current leader and the one to copy on flow, not features. Two things specifically: the editor opens _already focused on the image_ with no file dialog, and the primary button is **Copy**, not Save. Count the actions between capture and a PNG on the clipboard — it is three. That number is the product.                                                                                        |
| **Snagit** (TechSmith)                                    | The enterprise reference, and the data-model lesson: a `.snag` file keeps every annotation as a live, re-editable object and only flattens at export. Copy that exactly — it is §3 of the architecture doc. Also study its **Step** tool (auto-incrementing numbered badges), which is the single most-used annotation in any bug report, and **Simplify**, which replaces real UI with abstract blocks. |
| **Skitch** (Evernote, feature-frozen since ~2016)         | The cautionary example, and still the best arrow ever shipped: a tapered, hand-drawn-looking arrow with a fixed small palette so there is no colour-picking decision to make. Skitch did arrow + pixelate + text and nothing else, and that was enough. It lost its users not to a better editor but to faster capture-and-paste loops. Scope lesson and arrow lesson in one product.                    |
| **Annotorious** (annotorious.dev, open source, JS)        | Solves a large part of this exact problem, so **read the source**. It implements the W3C Web Annotation model, where a selector stores a media fragment in the _image's own pixel coordinates_ — the invariant this whole project is built on, already written down as a standard. Its `W3CImageFormat` and selector code are the parts worth reading; its UI is not what you want.                      |
| **Excalidraw** (open source)                              | Read `resizeElements.ts` and the pointer-down handling. The negative-width flip, the live-handle mirroring, and shift-to-keep-aspect are all there, already debugged, in code you can follow. Read it, write your own, and compare — that comparison is most of the value in §7 of the architecture.                                                                                                     |
| **Flameshot** (open source, C++/Qt)                       | Small enough to read end-to-end in an hour. Its pixelate tool and auto-incrementing counter are each about 60 lines, and its tool classes are a clean example of the per-tool state machine the architecture calls for.                                                                                                                                                                                  |
| **macOS / iOS Markup** (built into Preview, Photos, Mail) | The floor. Every user already has a free annotator with rectangles, arrows and text, so a clone of it has no reason to exist. Useful for exactly that reason: it tells you the differentiators are export fidelity, clipboard speed, and pixel-accurate zoom — not having more shapes.                                                                                                                   |

Business-logic insight: **this category is not drawing software, it is paste software.** The retained behaviour is _open screenshot → draw two things → ⌘C → paste into Slack or a Jira ticket_, and the products that win do it in under eight seconds. CleanShot and Shottr charge real money for the speed of that loop while shipping fewer tools than the free built-in Markup; Skitch had the tools and lost on loop speed. The consequence for this build is counter-intuitive: **export quality and clipboard reliability are the product, and the annotation tools are table stakes.** That is why §6 of the architecture is the longest section, why Copy is the primary button in the design file on every screen, and why shipping six well-behaved tools beats shipping twelve.

## How to use these milestones

Each milestone has four parts:

- **Goal** — one sentence. If you cannot say it in one sentence the milestone is too big.
- **Screens** — which captures in `flow.html` become real. A milestone with no screen is infrastructure and says so.
- **Build** — the checkbox list. File paths match §10 of `ARCHITECTURE.md`.
- **Check** — what you run or look at to prove it works. Do this before committing, not after.
- **Commit** — the message. One commit per milestone keeps `git bisect` useful and makes a broken export easy to find later.

Rules that hold across all of them:

- **Never commit on a red check.** A failing check means the milestone is not done, not that the check is wrong.
- **M2 is a gate.** Nothing after it is trustworthy until its test is green. Do not build tools first and retrofit coordinates.
- **M8 and M11 carry the acceptance tests that matter.** Everything else catches mistakes you would notice; those two catch the mistakes you would ship.
- **If you have one week, stop after M8.** That is a deployable annotator with a correct export. M11–M14 are where the stated learning goals live and are the reason to do the project at all. M9–M10 keep images across reloads and give every state a URL. M15–M19 complete the design file.

| Phase                        | Milestones | What exists at the end                                                                |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| **A · Foundation**           | M0–M2      | A crisp canvas, the editor laid out around it, a coordinate chain with a passing test |
| **B · The paste loop**       | M3–M8      | Open → draw → Copy. Deployable, and the export is provably correct                    |
| **C · Kept and addressable** | M9–M10     | The library in this browser, and a URL for every state                                |
| **D · The learning goals**   | M11–M14    | Zoom, compositing, text metrics, live redaction                                       |
| **E · The whole flow board** | M15–M19    | All 37 screens, including the phone                                                   |

The order is layout first, then coordinates, then behaviour: the shell (M1) draws nothing, so it cannot store a wrong coordinate, and every control that touches the canvas comes after the gate (M2). The library and routing follow the MVP (open question 1, settled).

---

## Phase A · Foundation

### M0 — A crisp canvas and a render loop

**Goal.** Two stacked canvases that are sharp on a Retina display and redraw only when something changed.

**Screens.** None. Infrastructure.

**Build.**

- [x] Next.js 16 + React 19 + TypeScript 5, strict mode on; shadcn/ui for the chrome (see the decisions log).
- [x] Two stacked `<canvas>` elements: `base` and `overlay`.
- [x] DPR sizing: `canvas.width = Math.round(cssW * dpr)` with `canvas.style.width = cssW + 'px'`, both axes, on both canvases.
- [x] A single `requestAnimationFrame` loop driven by a dirty flag, not a timer.
- [x] A hard-coded rectangle drawn to `base`, and a `ResizeObserver` that re-sizes and re-renders.

**Check.** On a Retina screen the rectangle's edges are hairline-sharp, not soft — if they are soft, `dpr` is missing. Resize the window and confirm no stretching. In DevTools, confirm `canvas.width === cssW * devicePixelRatio`. Add a counter to the rAF callback and confirm it stops incrementing when idle.

**Commit.** `scaffold: two-canvas render loop with DPR-correct sizing`

---

### M1 — The editor shell, laid out

**Goal.** Screen `09`'s chrome built with every control in place around the M0 canvas, so the product looks like the design file before any of it works.

**Screens.** `09` The annotator — layout only, with the design file's sample filename, zoom readout and layers.

**Build.**

- [ ] Switzer self-hosted with `next/font/local`, fetched from Fontshare at build time and never committed (its licence forbids redistribution); Geist Mono for readouts.
- [ ] Lucide icons, the set the design file draws.
- [ ] Top bar: wordmark, `Images` nav, `Shortcuts`.
- [ ] Editor bar: filename + natural size, the six-tool row as a single-choice group, undo/redo (disabled until M7), zoom group (`−`, readout, `+`, `Fit`, `1:1`), `Export`, `Copy`.
- [ ] `Copy` is the primary button. `Export` is secondary. Do not invert this later.
- [ ] The M0 canvas fills the stage, sized by the layout through its `ResizeObserver`, with the status strip under it: cursor readout and status line.
- [ ] Right rail: the inspector (six swatches, stroke and opacity sliders, the image-pixel microcopy) above the layers list and its reorder hint.
- [ ] Controls hold UI state only — tool, swatch, slider values, layer visibility — and nothing reaches the canvas. A button whose behaviour comes later names that milestone in its tooltip.
- [ ] A strip at the top says the filename, zoom and layers are sample data; M3 removes it when a real image opens.

**Check.** At 1440 × 900, open the shell beside `hallmark/index.html#/annotate/3f9a1c07b2e4` (screen `09`): the same regions in the same order at the same sizes (56 px top bar, 320 px rail, 36 px controls, 41 px status strip), and Copy is the one orange button. Resize the window: the stage shrinks, the rail keeps its width, and M0's checks still pass at 2x and 1x inside the new layout. The tool row is reachable by keyboard and announces the selected tool. No font request goes to a third-party host.

**Commit.** `shell: screen 09 laid out, controls in place, nothing wired`

> The shell is safe to build before the coordinate chain because it draws nothing. The first control that changes the canvas waits for M2.

---

### M2 — The coordinate chain · **gate**

**Goal.** One module owns image ↔ screen ↔ device, and a test proves it is invertible.

**Screens.** None. This is the most important milestone in the project.

**Build.**

- [x] `geom/matrix.ts`: build `M` from the camera, `Mi = M.invertSelf()`, export `toImage` and `toScreen`. **Export `M` only** — no other module may construct a matrix.
- [x] `geom/camera.ts`: `fit(nat, view)` with 5% breathing room. Zoom comes in M11.
- [x] The device matrix (`dpr` folded in) is built and used **only** inside `render/view.ts`, in the one and only call to `ctx.setTransform`.
- [x] Vitest: `toImage(toScreen(p)) ≈ p` within `1e-9` across `scale ∈ {0.1, 0.26, 1, 4, 8}` × `dpr ∈ {1, 2, 3}` × non-zero pan.
- [x] A comment at the top of `model/types.ts`: _ALL geometry is image space._
- [x] Replace M0's square with a sample image drawn through `M` at `fit()`: a generated 3840 × 2407 test chart (drawn in the browser rather than committed; see the decisions log) with labelled landmarks at known pixels, so the shell reads like the mock and the chain can be checked by eye.
- [x] The status strip's cursor readout shows the image pixel under the pointer, `x 2964 y 939`, and `Pointer off` when the pointer leaves the canvas.

**Check.** The invertibility test is green across all 45 combinations. Then `grep -rn "setTransform" src/` returns exactly one hit, in `render/view.ts`, and `grep -rn "devicePixelRatio" src/` returns hits only in `render/view.ts`. If either returns more, fix it now — this is the bug that is unreproducible on an external monitor. Finally, hover two landmarks on the test chart at 2x and at 1x: the readout shows their known coordinates on both.

**Commit.** `geom: image/screen/device coordinate chain with invertibility test`

> Do not start M3 until this test passes. Every later milestone assumes it.

---

## Phase B · The paste loop

### M3 — Open an image

**Goal.** Get an arbitrary user file on screen, correctly oriented, or say precisely why not.

**Screens.** `01` Open an image · `02` A file dragged over the page · `03` A HEIC file it can't decode

**Build.**

- [x] `ui/dropzone.tsx` accepting all three paths: file picker, drag-and-drop, and the `paste` event (`DataTransferItem` → `Blob`).
- [x] A drag-over state for the whole page (screen `02`), not just the drop target.
- [x] `createImageBitmap(blob, { imageOrientation: 'from-image' })`.
- [x] Natural size shown in the chrome as `3840 × 2407 px` next to the filename, replacing the shell's sample filename, and the sample-data strip removed.
- [x] Decode failure names the codec and asks for PNG/JPEG/WebP (screen `03`), never an empty canvas.
- [x] Fixtures committed: one EXIF-rotated phone photo, one HEIC, one 1 px PNG.

**Check.** Drop the HEIC fixture — you get the named codec message, not a blank canvas. Drop the EXIF-rotated fixture — it appears upright, and the pixel at a known corner is the one you expect. Copy an image in another app and paste onto the page — it loads. The natural-size readout matches what `sips -g pixelWidth` reports for the file.

**Commit.** `open: dropzone with pick, drop, paste and codec rejection`

---

### M4 — The annotator states

**Goal.** The decode and empty states and a real status line — with `drawScene` created but drawing only the bitmap.

**Screens.** `08` Decoding the image · `10` Nothing drawn yet

**Build.**

- [ ] `render/scene.ts` with the final signature from day one, even though it only blits the bitmap:
      `drawScene(ctx, doc, bitmap, opts: { minVisualStroke: number })`.
- [ ] Decoding state (screen `08`).
- [ ] A second file opened while one is still decoding replaces it cleanly: the superseded decode is dropped and its bitmap closed (found in the M3 review).
- [ ] Empty-canvas state (screen `10`).
- [ ] Status bar: annotation count and last-edited timestamp, from the document rather than the shell's sample line.

**Check.** Open a large image and confirm screen `08` shows until the first frame, never an empty stage. Open an image with nothing drawn and confirm screen `10`. Confirm `drawScene` already accepts a `ctx` parameter — if the export path has to be written against a different function later, this milestone failed.

**Commit.** `annotator: decode and empty states, shared drawScene signature`

---

### M5 — Rectangle, model, selection

**Goal.** Draw a rectangle, select it, move it — with one state machine instead of booleans.

**Screens.** `12` Drawing a box, mid-drag · `13` A box selected

**Build.**

- [ ] `model/types.ts` (annotation union), `model/doc.ts` (`Map<Id, Annotation>` + `order[]`, the only place annotations mutate), `model/bbox.ts` (per-kind, including stroke).
- [ ] `render/draw/rect.ts`.
- [ ] `geom/hit.ts`: reverse-order scan, `tol = 6 / scale`.
- [ ] `interact/machine.ts`: the states from §9 of the architecture, with the **3 CSS px** click-vs-drag threshold.
- [ ] Draft rendered on the overlay during `drawing`; the model is written once on pointer-up, then auto-selected.
- [ ] Move by drag. Delete via `Delete` / `Backspace`. `Esc` discards an in-progress operation.

**Check.** Draw two overlapping rectangles and confirm a click selects the top one. Click without moving and confirm it selects rather than creating a 0×0 rectangle. Drag and confirm the model is untouched until pointer-up (log the write). Press `Esc` mid-drag and confirm the draft vanishes with nothing committed.

**Commit.** `rect: annotation model, hit testing and the interaction state machine`

---

### M6 — Resize handles

**Goal.** Eight handles with correct anchors, including dragging past the opposite edge.

**Screens.** `14` Resizing past the opposite edge

**Build.**

- [ ] `geom/resize.ts`: anchor per handle, negative-size flip, live-handle mirroring, shift-to-keep-aspect.
- [ ] Handles drawn on the overlay at a fixed **8 CSS px**, converted at point of use — never stored.
- [ ] A Vitest table: (start rect, handle, pointer) → expected rect, covering single-axis flip, both-axis flip, and shift-aspect.

**Check.** The table passes. Then by hand: grab the NW handle and drag it past SE — the rectangle mirrors, and the handle under your cursor stays the one you grabbed. At 10% zoom and at 400% the handles are the same physical size on screen.

**Commit.** `resize: eight handles with flip and shift-aspect`

---

### M7 — Arrow, inspector, undo

**Goal.** The second tool, the three property controls, and an undo that steps by operation.

**Screens.** `20` An arrow selected on a circuit board

**Build.**

- [ ] `geom/arrow.ts`: head angle and length computed along the shaft, clamped against shaft length, with the shaft shortened to meet the head.
- [ ] `ui/inspector.tsx`: a fixed **6-swatch** palette and no picker; stroke slider; opacity slider. The controls exist from M1; this wires them to the model.
- [ ] Stroke is stored in **image px**, and the inspector says so in place: _"Image pixels, so it exports at this width at any zoom."_ Default `max(2, naturalWidth / 400)`, with the arithmetic shown.
- [ ] `history/undo.ts`: inverse property patches, capped at 100 entries, `⌘Z` / `⇧⌘Z`.
- [ ] Degenerate arrows (`len < 2 * strokeWidth`) discarded on commit.
- [ ] Vitest: arrowheads at `len = 3`, `40`, `2000` — no NaN, head never longer than 28% of the shaft nor shorter than `4 × strokeWidth`, head angle constant.

**Check.** A single drag produces **one** undo entry, not 300 — hold `⌘Z` and confirm it steps by operation. Draw a 30 px arrow and confirm it is not 90% arrowhead. Draw a diagonal arrow and confirm the head is not skewed. The stroke microcopy is on screen and the number in it matches the loaded image.

**Commit.** `arrow: shaft geometry, inspector controls and inverse-patch undo`

---

### M8 — Export and Copy · **MVP complete**

**Goal.** A PNG at natural size, on the clipboard, pixel-correct.

**Screens.** `21` Copy, and nothing sent · `22` No clipboard on this page · `23` The clipboard blocked · `25` Export a PNG

**Build.**

- [ ] `export/render.ts`: `OffscreenCanvas(naturalWidth, naturalHeight)`, identity transform, `await document.fonts.ready`, then the same `drawScene` with `minVisualStroke: 0`.
- [ ] `export/encode.ts`: `convertToBlob` — never `toDataURL`.
- [ ] `export/clipboard.ts`: `ClipboardItem` given the blob **promise**, called synchronously from the click. Never `await` the blob first.
- [ ] The export page (screen `25`): live preview with its own scale readout, `Output px` / `Pixels MP` / `Budget MP`, `Copy PNG` primary and `Download PNG` secondary.
- [ ] Caption the preview _"Drawn from the document at the image's own size, never from the screen."_
- [ ] On insecure context or missing API, `Copy` is replaced by `Download` with the reason (screens `22`, `23`). It never silently no-ops.
- [ ] A copy-succeeded confirmation (screen `21`).

**Check — the MVP acceptance test.** Load a 3840×2407 screenshot; it fits at ~24%. Draw a rectangle tightly around a known UI element. Export, open the PNG in Preview at 100%, and read the rectangle's top-left with the cursor readout — **within 1 px** of where it sits in the editor. Confirm the file is **3840×2407 and not 7680×4814** on a Retina laptop. Click `Copy`, paste into Slack, and the image arrives with the rectangle on it. Then load the page over plain `http` and confirm `Copy` has become `Download` with an explanation. In Safari specifically, confirm `Copy` works — if it fails, you awaited the blob.

**Commit.** `export: natural-size render, PNG encode and clipboard copy — MVP`

> This is a shippable product. Deploy it before starting Phase C.

---

## Phase C · Kept and addressable

### M9 — The library in this browser

**Goal.** An image and its annotations survive a reload, filed under the hash of the bytes.

**Screens.** `04` The images, loading · `05` No images here yet · `06` Storage blocked · `07` Forget an image, confirmed first · `11` Annotations unreadable · `32` An image not in this browser

**Build.**

- [ ] `model/persist.ts`: IndexedDB via `idb` 8, storing the image `Blob` and the doc keyed by **SHA-256 of the source bytes** (`crypto.subtle.digest`).
- [ ] The "In this browser" page listing stored images with thumbnails.
- [ ] Loading state as skeletons, never a spinner (screen `04`).
- [ ] Empty state with the explanation that opening the same file brings its annotations back, and one primary action (screen `05`).
- [ ] Storage-blocked state for private mode / denied quota, with the picture-still-works reassurance (screen `06`).
- [ ] "Forget an image" behind a confirm (screen `07`).
- [ ] An unknown hash resolves to a stated dead end, not a crash (screen `32`).
- [ ] Annotations-unreadable: dim the image, offer **Try again** and **Start without them**, and show the inline error in the Layers rail — the picture is fine and must stay usable (screen `11`).
- [ ] Debounced write, 400 ms.

**Check.** Open a file, draw nothing, reload — the image is in the library. Open the _same_ file from a different folder path and confirm it resolves to the same record, proving the key is the bytes and not the name. Open the app in a private window with storage blocked and confirm screen `06` instead of a white page. Navigate to `#/annotate/000000000000` and confirm screen `32`. Force a storage read failure and confirm screen `11`: the image still renders, Layers shows the inline error, and **Start without them** leaves you in a working editor.

**Commit.** `library: IndexedDB store keyed by image hash, with empty, loading and blocked states`

---

### M10 — Routes and dead ends

**Goal.** Every screen in the design file has a URL, so every state is reproducible.

**Screens.** `33` No page at this address — plus it makes all the `?state=` and `?select=` links in `flow.html` resolvable.

**Build.**

- [ ] Hash routing: `#/`, `#/annotate/:hash`, `#/annotate/:hash/export`.
- [ ] State query params read on load: `tool`, `select` (comma-separated ids), `edit`, `zoom`, `at=x,y`, `format`, `state`, `clipboard`, `drop`.
- [ ] A 404 for any unmatched path (screen `33`).
- [ ] Selection and tool write back to the URL so a state can be copied out of the address bar.

**Check.** Walk every "Open live" link in `hallmark/flow.html` and confirm each lands on the state its caption claims — this is the single highest-value hour in the project, because from here on every bug is reproducible by URL. `#/somewhere-else` gives screen `33`. Select three annotations, copy the URL, open it in a new tab, and get the same three selected.

**Commit.** `routing: addressable states for every screen`

---

## Phase D · The learning goals

### M11 — The camera, and proving zoom does not leak · **the test that matters**

**Goal.** Cursor-anchored zoom and pan, and a test proving stored geometry never learned about either.

**Screens.** `18` At 400%, pixels showing

**Build.**

- [ ] `geom/camera.ts`: `zoomAt(cam, cursorScreen, k)` clamped 10%–800%, computing `toImage(cursor)` **before** changing scale.
- [ ] Pan: space-drag, middle-drag, trackpad two-finger — all tool-independent.
- [ ] `Fit` and `1:1` buttons; readout as `24% · 3840 × 2407` so the percentage is never ambiguous.
- [ ] `ctx.imageSmoothingEnabled = false` above 200%.
- [ ] Hit tolerance and handle sizes derived as `k / cam.scale` at point of use.
- [ ] `minVisualStroke = 1 / cam.scale` for the view, `0` for the export.
- [ ] Vitest: `zoomAt` keeps `toImage(cursor)` unchanged before and after.

**Check — the zoom-independence test.** Render a fixture doc twice, camera at 25% and at 400%, and assert the two exported blobs are **byte-identical**. Then by hand: zoom to 25%, draw a rectangle and an arrow over two landmarks, export; undo both, zoom to 400%, draw the same two over the same landmarks, export — the PNGs agree to within 1 px with identical stroke widths. Finally `grep` the codebase and prove no screen-px value is ever assigned to an annotation field.

**Commit.** `camera: cursor-anchored zoom and pan, with zoom-independence proven`

> This is the project's reason to exist. If this check is red, something earlier is wrong — do not paper over it in the exporter.

---

### M12 — Highlight and the four-pass compositor

**Goal.** A highlighter that behaves like a marker and does not darken the arrows.

**Screens.** The yellow highlight visible in `09`.

**Build.**

- [ ] Split `drawScene` into four ordered passes: bitmap → pixelate → highlights (`globalCompositeOperation = 'multiply'`) → opaque annotations (`source-over`, in `order`).
- [ ] Highlight tool constrained to a band, with its own default opacity.
- [ ] Reset `globalCompositeOperation` at the end of the highlight pass.

**Check.** Draw a highlight over body text — the text stays readable, which `source-over` at 35% alpha would not achieve. Draw an arrow, then a highlight crossing it — the arrow is **not** darkened. Reorder two highlights and confirm the result is unchanged, since multiply is commutative.

**Commit.** `highlight: multiply pass ordered before opaque annotations`

---

### M13 — Text that exports identically

**Goal.** Wrapped canvas text with a legibility plate, edited through a DOM overlay, wrapping the same on export as on screen.

**Screens.** `17` Editing a label — and the plated labels in `09`.

**Build.**

- [ ] `render/text-layout.ts`: `measureText` on one shared offscreen context, memo cache keyed by `` `${font}|${text}` ``, greedy word wrap against `a.width`.
- [ ] Height from `actualBoundingBoxAscent + actualBoundingBoxDescent`, falling back to `fontSize * 1.2`.
- [ ] Optional background plate: rounded rect at the wrapped bbox inflated by `fontSize * 0.35`, `rgba(0,0,0,0.72)`.
- [ ] `interact/text-overlay.ts`: a positioned `<textarea>`, `fontSize * cam.scale`, identical font stack and line-height, committing to the model on blur.
- [ ] A system font stack, so there is usually nothing to load.
- [ ] `bbox` for text equals the wrapped-and-plated box.

**Check.** Write a 40-word annotation with the plate on, export, and confirm the exported line breaks are **character-for-character** identical to the preview — including after a hard reload where fonts load cold. Drag a long text annotation and confirm no frame-rate drop, proving the measure cache is being hit.

**Commit.** `text: wrapped canvas text with plate and DOM editing overlay`

---

### M14 — Pixelate, kept live

**Goal.** Redaction that stays editable, because the stored document must fully describe the output.

**Screens.** The two `Pixelate` layers in `09`.

**Build.**

- [ ] `PixelateA` stores a region and a block size — never baked into the bitmap.
- [ ] Read-back, nearest-neighbour downscale to `sw/block`, then draw back up with smoothing off.
- [ ] Recomputed from the source bitmap on every render, in the pass **before** highlights.

**Check.** Pixelate a face, reload the page, and confirm the region is still selectable, movable and resizable. Draw an arrow, then confirm the arrow is **not** pixelated — if it is, the pixelate pass is running too late. Export and confirm the redaction is present at full resolution and genuinely destroys the underlying detail.

**Commit.** `pixelate: live redaction recomputed from source each render`

---

## Phase E · The whole flow board

### M15 — Layers and multi-select

**Goal.** The right-rail layer list, z-order control, and selecting more than one thing.

**Screens.** `15` Marquee select, mid-drag · `16` Three selected

**Build.**

- [ ] `ui/layer-list.tsx`: count, per-row type icon, semantic name, size **in image px**, visibility toggle, drag handle. The rows are laid out from M1; this makes them the document's.
- [ ] Reorder by drag and by `⌥↑` / `⌥↓`, with the hint visible in the rail.
- [ ] Marquee select on empty canvas with the select tool.
- [ ] A combined bbox with handles for a multi-selection; move and delete as one operation.

**Check.** Eight annotations list with image-px sizes matching the inspector. Drag a row and confirm paint order changes on canvas. Marquee three, move them, and confirm a single `⌘Z` restores all three. Toggle visibility and confirm the hidden annotation is absent from the **export** too.

**Commit.** `layers: z-order list, visibility and marquee multi-select`

---

### M16 — Export, the whole dialog

**Goal.** Three formats, real engine limits, and honest degradation instead of a blank PNG.

**Screens.** `26` Export a JPEG · `27` Export the annotations as JSON · `28` Over the 64 MP budget · `29` Export, drawing · `30` Export with nothing drawn · `31` An image the browser won't export

**Build.**

- [ ] Format list: PNG (_copy or download, lossless_), JPEG (_download, smaller for photos_), Annotations as JSON (_W3C Web Annotation, image pixels_).
- [ ] JPEG offers **no Copy**, because `ClipboardItem` only reliably accepts `image/png`. State it in the option rather than failing the button.
- [ ] A quality slider for JPEG.
- [ ] `export/limits.ts`: per-engine dimension and area caps plus a 1 px allocation probe.
- [ ] 64 MP budget: above it, downscale by `sqrt(budget / area)` and show the resulting dimensions (screen `28`).
- [ ] Rendering state while the export draws (screen `29`).
- [ ] Nothing-drawn state, which still exports a clean copy of the original (screen `30`).
- [ ] Tainted canvas detected at load with a 1 px `getImageData` probe; export disabled with the reason, not left to throw (screen `31`).

**Check.** Export the 108 MP fixture and confirm the dialog states the real downscaled output and produces a valid PNG — never a blank or transparent one. Assert output dimensions equal `naturalWidth × naturalHeight` with `devicePixelRatio` stubbed to 1, 2 and 3. Confirm `convertToBlob` output is PNG by magic bytes. Export JSON, re-import it onto the same image, and confirm the annotations land identically.

**Commit.** `export: formats, limits and honest degradation`

---

### M17 — Out of bounds

**Goal.** Tell the user before the export clips, because the export clips silently.

**Screens.** `19` An arrow past the image edge

**Build.**

- [ ] A dimmed gutter outside the image rect on the overlay.
- [ ] A badge when any annotation's bbox extends past the image bounds.
- [ ] No clamping — an arrow pointing inward from outside the frame is a real annotation.

**Check.** Drag an arrow so its tail sits outside the image; the gutter and badge appear. Export and confirm the output is exactly natural size with the outside part clipped — and that you were warned first.

**Commit.** `bounds: out-of-bounds gutter and badge`

---

### M18 — Shortcuts and keyboard

**Goal.** Every shortcut the panel advertises actually works.

**Screens.** `24` Keyboard shortcuts

**Build.**

- [ ] A shortcuts panel reachable from both the library and the annotator.
- [ ] Single-key tool switching; `⌘Z` / `⇧⌘Z`; `Delete`; `Esc`; space-pan; `⌥↑` / `⌥↓` reorder; `⌘C` copy.
- [ ] Shortcuts suppressed while the text overlay has focus.

**Check.** Work through every row in the panel and confirm each fires. Then open a text annotation for editing and confirm typing `r` inserts the letter rather than switching to the rectangle tool.

**Commit.** `keyboard: shortcut map and the shortcuts panel`

---

### M19 — The phone

**Goal.** The same three surfaces, usable on a 375 px viewport.

**Screens.** `34` Phone, open an image · `35` Phone, the annotator · `36` Phone, a box selected · `37` Phone, export

**Build.**

- [ ] Responsive library, annotator and export pages.
- [ ] Touch: one-finger pan, pinch zoom, and a larger hit tolerance for touch pointers.
- [ ] Inspector and layers as a bottom sheet rather than a side rail.
- [ ] iOS Safari's lower canvas cap (4,096–8,192 device-dependent) respected by `limits.ts`.

**Check.** On a real iPhone, open an image, draw a box, and copy it — the whole loop. Confirm a 20 MP image exports rather than returning blank, and that the budget notice reflects the iOS cap rather than the desktop one.

**Commit.** `responsive: phone layouts for library, annotator and export`

---

## Testing

The per-milestone checks are the primary gate. This section names the suites those checks draw on.

- **Unit (Vitest) — `geom/` is where the tests earn their keep:**
  - `toImage(toScreen(p)) ≈ p` within `1e-9` across `scale ∈ {0.1, 0.26, 1, 4, 8}` × `dpr ∈ {1, 2, 3}` × non-zero pan. If this fails nothing else can be correct (M2).
  - `zoomAt()` keeps the image point under the cursor fixed (M11).
  - Resize: a table of (start rect, handle, pointer) → expected rect, including both flip cases and shift-aspect (M6).
  - Arrowheads at `len = 3`, `40`, `2000` — no NaN, head ≤ 28% of shaft, ≥ `4 × strokeWidth`, constant angle (M7).
  - `bbox()` per kind: arrow includes head spread and half the stroke; text equals the wrapped-and-plated box.
  - `wrapText()` deterministic and idempotent for the same font and width (M13).
- **Export golden images — the highest-value suite:**
  - A fixture doc with one of every annotation kind at known image coordinates, rendered at natural size and compared to a committed golden PNG with `pixelmatch` at zero tolerance.
  - **The one test that matters: render the same fixture at 25% and at 400% and assert the two blobs are byte-identical.** This is the only test that can detect a view-space or `devicePixelRatio` value having leaked into stored geometry or into `drawScene`. Everything else catches mistakes you would notice; this one catches the mistake you would ship (M11).
  - Output dimensions equal `naturalWidth × naturalHeight` with `devicePixelRatio` stubbed to 1, 2 and 3.
  - The 64 MP budget path returns the documented downscaled dimensions rather than throwing (M16).
  - An EXIF-rotated fixture exports upright (M3).
- **Integration (Playwright, real Chromium):**
  - Paste an image, draw a rectangle, press `⌘C`, read the clipboard back, assert an `image/png` item of the expected dimensions (M8).
  - Reload and assert annotations return from IndexedDB (M9).
  - Every "Open live" URL in `flow.html` resolves to its captioned state (M10).
  - Drag an annotation past the edge and assert the badge appears (M17).
- **Manual, on a Retina display _and_ an external 1× monitor, every time export changes:** click a target at 800% zoom and confirm the hit lands under the cursor on **both**. The `dpr` bug is invisible at 1×, which is why this is a checklist item rather than a test you remember to run.
- **Perf:** 400 annotations — base redraw time, overlay fps while dragging, export wall time for 8 MP and 40 MP. Record the numbers in the README.

## Risks

| Risk                                                                                                  | Mitigation                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geometry stored in view space because that is what the pointer hands you                              | M2 is a gate with a passing invertibility test before any tool exists. Review rule: a number assigned to an annotation field may not have been produced without passing through `toImage` |
| `devicePixelRatio` folded into the pointer transform as well as the render transform                  | `ctx.setTransform` is called in exactly one function (`render/view.ts`); `M` is the only matrix the rest of the app can import. M2's check greps for both                                 |
| Export implemented as "scale up the view canvas"                                                      | M4 creates `drawScene` with its final signature before M8 needs it, so the export path has no drawing code of its own to write                                                            |
| Export silently produces a blank PNG on large images                                                  | `export/limits.ts` with the allocation probe and the 64 MP budget at M16, plus the dimension assertion in the golden tests                                                                |
| Text wraps differently in the export than in the preview                                              | One shared measurement context, a single `wrapText()`, `await document.fonts.ready`, and a system font stack so there is usually nothing to load (M13)                                    |
| Reaching for Konva/Fabric when the resize maths gets annoying                                         | Named and argued in the architecture's stack section. M6 is a bad afternoon with a test table, not a bad week                                                                             |
| **Scope grew: the design file adds a library, routing and a phone that the original tiers put in P2** | M9, M10 and M19 are now explicit milestones with their own budget. M8 is the stop line for a one-week build, and M11–M14 are the reason to continue                                       |
| Twenty milestones read as twenty weeks                                                                | M0–M8 is 1–2 weeks and ends deployable; the shell (M1) is a day. Phases C–E are each roughly a week. Open question 1 is settled: the library and routing come after the MVP               |
| Safari: clipboard write fails because activation was lost across an `await`                           | `ClipboardItem` is given the blob _promise_, never an awaited blob. M8's check tests Safari explicitly                                                                                    |
| EXIF-rotated photos make every annotation land wrong                                                  | `imageOrientation: 'from-image'` at M3, with a rotated fixture in the golden tests                                                                                                        |

## Explicitly out of scope

No accounts, no backend, no upload, no share links — the moment a PNG has to live at a URL this stops being a frontend project and becomes a storage, auth, and abuse-handling project. No multiplayer; project 11 is that project and does it properly with a CRDT. No rotation of annotations, which would add an inverse-rotation step to every hit test for a capability screenshot annotation does not need. No video or GIF annotation. No OCR and no AI auto-redaction of faces or card numbers — tempting, and a different two weeks. **Freehand pen is dropped**: the design file ships six tools and none of them is a pen, and stroke geometry is project 11's material rather than this project's coordinate-transform goal.

Still unbuilt but deliberately parked, in rough value order: auto-incrementing numbered **step badges** (the most-used annotation in real bug reports, and the highest value per hour of anything here), crop and straighten (instructive precisely because it changes `naturalWidth/Height` and so must transform every stored annotation), callouts with a tracking tail, arrows that bind to a rectangle and follow it, snapping guides, moving export into a Web Worker, and multi-image sessions with a shared style preset.

## Open questions

1. ~~**Should the library and routing come before the first annotation is drawn?**~~ **Settled 2026-11-12: no.** The build goes shell (M1) → coordinate chain (M2) → open (M3) → annotator states (M4) → tools (M5–M7) → Export and Copy (M8), and the library (M9) and routing (M10) follow the MVP. The cost, accepted: bug reports before M10 are not reproducible by URL. Screen `11` moved to M9 with the store it depends on.
2. **Is there an ellipse tool?** §10 of the architecture lists `draw/ellipse.ts` and `tools/ellipse.ts`, but the design file's toolbar has exactly six tools and ellipse is not among them. This plan follows the design file and **omits it**. Cheap to add in M5 since it shares the rectangle's bbox and resize maths; also the easiest thing to cut. Settle at M5, and if omitted, delete the two files from the architecture's layout so the tree does not lie.
3. ~~**What is "Pointer off" in the status bar?**~~ **Settled 2026-11-12 from the design file's own script** (`hallmark/app.js`): it is a live cursor readout in image pixels, `x 2964 y 939`, that reads `Pointer off` when the pointer leaves the canvas. The shell (M1) shows the resting text; M2 wires it through `toImage`, where it doubles as a check on the chain.
4. **Does the JSON export round-trip?** Screen `27` shows export only. This plan assumes a full round-trip in M16 (export and re-import onto the same image), since W3C Web Annotation selectors in image pixels are exactly the stored model and the import is nearly free. If it stays export-only, say so in the UI, because "Annotations as JSON" implies you can bring them back. Settle at M16.
5. **Is the phone a full editor or a viewer?** Screens `34`–`37` show a phone annotator _with a box selected and an export page_, implying full editing on a 375 px viewport — where an 8 CSS px handle is a 3 mm target and precise boxing is unrealistic. The alternative is phone-as-viewer: open, inspect, copy and export, but create and resize only on a pointer device. **Recommendation: full editing, with touch hit tolerance raised well above the 6 px pointer value and handles enlarged for coarse pointers.** Settle at M19.
6. **What bounds storage growth?** Every image is kept as a full `Blob` under its hash, and screen `07` is the only way to remove one — a manual, per-image "forget". Ten 4 K screenshots is comfortably past 50 MB, and nothing in the design file shows a quota warning, an LRU eviction, or a total-usage figure. Options: surface `navigator.storage.estimate()` in the library, evict least-recently-opened above a cap, or keep the doc and drop the blob so annotations survive but the image must be re-dropped. Settle at M9, because retrofitting eviction means a schema change.
7. **After "Start without them", what happens to the unreadable record?** Screen `11` offers **Try again** and **Start without them**. If the user starts without them and draws, does the new document overwrite annotations that might have been recoverable? This plan assumes the original record is preserved untouched and the session writes to a new key until the user explicitly discards the old one — losing annotations to a transient IndexedDB failure is the worst outcome available here. Settle at M9.

## Decisions log

| Date       | Milestone | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-12 | M0        | **Next.js 16 (App Router) + React 19 + shadcn/ui instead of Vite 5 + React 18.** Still client-only: the editor is one statically prerendered page whose surface is a Client Component, with no API routes and no server code. Hash routing (M10) works unchanged, because everything after `#` never reaches a server.                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-11-12 | M0        | Lint and format follow `boyanliu.me`: `eslint-config-next` + `eslint-config-prettier` + `prefer-arrow-functions`, Prettier with Tailwind class sorting. shadcn components are converted to arrow functions with `eslint --fix` after `shadcn add`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-11-12 | M0        | shadcn style `radix-lyra` (square corners, Phosphor icons), with its tokens replaced by the design file's dark palette in `src/app/globals.css`. Geist Mono is loaded with `next/font`; Switzer followed in M1 (below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-11-12 | M0        | §10's `ui/` becomes `src/components/` (app components, e.g. `components/editor/`), with shadcn primitives in `src/components/ui/`. The pure modules (`model/`, `geom/`, `render/`, `export/`, `interact/`, `history/`) sit directly under `src/` as laid out.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-11-12 | M0        | The view owns resizing: the container's size drives the canvases, floored to whole CSS px so the backing store is exactly `cssW × dpr` at whole-number ratios. A resize redraws synchronously inside the `ResizeObserver` callback rather than next frame, so dragging the window edge never shows a blank canvas. A `resolution` media query re-sizes when the window moves to a display with a different ratio.                                                                                                                                                                                                                                                                                         |
| 2026-11-12 | M0        | M2's grep rule is enforced from M0 by `tests/architecture.test.ts`: exactly one `setTransform` in `src/`, in `src/render/view.ts`, and `devicePixelRatio` read nowhere else. It lives outside `src/` so the plan's literal `grep -rn … src/` stays exact.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-11-12 | M0        | Every Playwright check runs twice, at `deviceScaleFactor` 2 and 1, since the DPR bug is invisible at 1x. The sharpness check also asserts the square's position in device px, which catches a ratio missing from the canvas transform (verified by mutation: it fails at 2x and passes at 1x).                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-11-12 | Order     | **Layout first, then coordinates, then behaviour**, so the product is visible early. Every milestone was renumbered: a new M1 lays out screen `09` with inert controls; the coordinate chain became M2 and stays the gate; the library and routing (now M9–M10) moved behind Export and Copy (M8). Screen `11` moved from the annotator states (now M4) to the library, because it needs a store that can fail. Old → new: M1→M2, M2→M3, M5→M4, M6–M9→M5–M8, M3→M9, M4→M10, M10–M18→M11–M19.                                                                                                                                                                                                              |
| 2026-11-12 | M1        | **Lucide icons instead of Phosphor**: the design file draws Lucide's paths (mouse-pointer-2, square, arrow-up-right, highlighter, type, grid-3x3, undo-2, redo-2, grip-vertical, eye), so `components.json` now names `lucide`. Strokes are 1.5 px with square caps, as in the design file.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-12 | M1        | **Switzer is self-hosted but never committed.** Its licence (ITF FFL 2.0) allows self-hosting for your own site and forbids making the files available through a repository, so `scripts/fetch-fonts.mjs` downloads the official WOFF2 files from Fontshare before `dev` and `build` into a git-ignored folder, and `next/font/local` serves them from this app. Nothing is fetched from a font host at runtime.                                                                                                                                                                                                                                                                                          |
| 2026-11-12 | M1        | The shell's filename, zoom readout and layer rows are the design file's sample data, labelled as such by a strip at the top, in `components/editor/sample.ts` so M3 and M15 can delete them in one place.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-11-12 | Name      | **Renamed from Plumb to Snapmark**, a friendlier name: _snap_ (the screenshot) + _mark_ (drawing on it). The app folder, package, title and wordmark changed; the Hallmark design file keeps its working title, Plumb.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-11-12 | M2        | **The test chart is generated in the browser, not committed** (`render/test-chart.ts`): the same pixels every run, no binary to keep in step with the code, and M3 replaces it with real images. Its landmarks are solid squares of colours used nowhere else, so the browser checks find them in the painted pixels rather than trusting a formula.                                                                                                                                                                                                                                                                                                                                                      |
| 2026-11-12 | M2        | **`DOMMatrix` as the architecture says, with happy-dom for the unit tests**, since Node has no `DOMMatrix`. `M` lives in `geom/matrix.ts`; the device matrix is `deviceMatrix()` in `render/view.ts` (`M` with the pixel ratio in front); `tests/architecture.test.ts` now fails if any other file mentions `DOMMatrix`. The one `setTransform` call is wrapped in `setMatrix()`, which clears in device px and then applies the layer's matrix.                                                                                                                                                                                                                                                          |
| 2026-11-12 | M2        | The plan's 45-combination round trip runs the whole chain (image → device → screen → image), because `toImage(toScreen(p))` alone would pass with the pixel ratio misused and with scale and pan in the wrong order; a second test pins scale-then-pan. The browser check hovers each landmark where it was painted and reads the coordinates back; proven by mutation, it fails at 2x and passes at 1x both when the pointer is read through the device matrix and when the base is painted without the ratio.                                                                                                                                                                                           |
| 2026-11-12 | M2        | The cursor readout shows the pixel whose square contains the pointer (`Math.floor`), and lives in a small external store so a pointer move re-renders one line, not the stage. The zoom readout now shows the real fitted scale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-13 | M2        | Review clean-up: the stage takes one `image` (bitmap + natural size, kept apart because a downscaled display bitmap is planned), the editor reads the chart's own name and size instead of a duplicated sample record, the e2e checks import the landmarks from `test-chart.ts`, and the `?debug` readout lost M0's Redraw button and ✓, now covered by tests. The pointer readout and zoom stay blank until an image has loaded.                                                                                                                                                                                                                                                                         |
| 2026-11-13 | M3        | **Formats are told by their first bytes, not the name or MIME type** (`model/image.ts`): a pasted screenshot arrives as `image.png` whatever it is, and a renamed HEIC is still HEIC. PNG, JPEG and WebP open; HEIC, AVIF, GIF, TIFF, BMP and SVG are refused with the format named ("photo.heic is a HEIC image. Snapmark opens PNG, JPEG and WebP: save it as one of those and try again."), even where a browser could decode them, so behaviour doesn't change between browsers.                                                                                                                                                                                                                      |
| 2026-11-13 | M3        | Screens switch by state in `components/app.tsx` until hash routing (M10). "Open the sample" opens the test chart with the design file's sample layers; an image you open starts with an empty layer list. The open screen's figure is built from the same view code: three lenses on the chart (fitted, 400%, 1:1) marking landmark A on the design file's signature pixel, 2964, 939. Pixels show as squares above 200% (`render/image.ts`), pulled forward from M11 for the 400% lens.                                                                                                                                                                                                                  |
| 2026-11-13 | M3        | Fixtures are generated by `scripts/make-fixtures.mjs` (Chromium for the PNG and JPEG, macOS `sips` for HEIC) and committed in `e2e/files/`. Finding: current Chromium treats `imageOrientation: "none"` as `"from-image"` (the value is deprecated), so the EXIF test was proven with `flipY` instead, which it catches at 2x and 1x.                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-11-13 | M3        | **The sample is now the design file's own photo**, "Crosswalk of Market at Third, San Francisco" by Dllu (Wikimedia Commons, CC BY-SA 4.0), served from `public/samples/` as a 3840 × 2407 WebP (2.2 MB, re-encoded from Wikimedia's rendition; see `public/samples/CREDITS.txt`) and credited on the open screen and in the editor. The design's sample layers now describe what is in the picture, and the hero marks its signature pixel, the taxi box corner at 2964, 939. The generated test chart left the app and became an e2e fixture (`e2e/files/test-chart.png`, drawn by `scripts/make-fixtures.mjs` from `e2e/chart.ts`), so the coordinate checks now open it through the real file picker. |
| 2026-11-13 | M3        | **The sample is a landscape instead**, chosen by the user over the city view: "Lago di Braies" by Luca Bravo (Unsplash via Wikimedia Commons, CC0), 4554 × 3036 at full size as an 858 KB WebP. Rowboats with painted numbers give crisp edges to box and read; the signature pixel is the top-left of the "14", 2136, 2651, found from the pixels. The sample layers keep the design's shapes, with the two text labels rewritten for this photo. CC0 needs no credit; it is given anyway. Supersedes the city photo above.                                                                                                                                                                              |
