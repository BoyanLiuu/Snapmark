# Snapmark — Milestones

How to read this: `[x]` done and verified, `[ ]` not yet. A milestone is done when every box is
ticked, `pnpm check` passes and `pnpm test:e2e` passes. Goals, checks and rationale live in
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md); the design is
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Order (changed 2026-11-12):** layout first, then coordinates, then behaviour. The shell draws
nothing, so it can't store a wrong coordinate; every control that touches the canvas waits for the
M2 gate. The library and routing come after the MVP. Old numbers are mapped in the plan's
decisions log.

| Phase                    | Milestone                                    | Status  |
| ------------------------ | -------------------------------------------- | ------- |
| A · Foundation           | M0 — A crisp canvas and a render loop        | ✅ Done |
|                          | M1 — The editor shell, laid out              | ✅ Done |
|                          | M2 — The coordinate chain · **gate**         | ✅ Done |
| B · The paste loop       | M3 — Open an image                           | ✅ Done |
|                          | M4 — The annotator states                    | ✅ Done |
|                          | M5 — Rectangle, model, selection             | ✅ Done |
|                          | M6 — Resize handles                          | ✅ Done |
|                          | M7 — Arrow, inspector, undo                  | ✅ Done |
|                          | M8 — Export and Copy · **MVP**               | ✅ Done |
| C · Kept and addressable | M9 — The library in this browser             | ✅ Done |
|                          | M10 — Routes and dead ends                   | ✅ Done |
| D · The learning goals   | M11 — The camera, zoom does not leak         | ✅ Done |
|                          | M12 — Highlight and the four-pass compositor | ✅ Done |
|                          | M13 — Text that exports identically          | ✅ Done |
|                          | M14 — Pixelate, kept live                    | ✅ Done |
| E · The whole flow board | M15 — Layers and multi-select                | ✅ Done |
|                          | M16 — Export, the whole dialog               | ✅ Done |
|                          | M17 — Out of bounds                          | ✅ Done |
|                          | M18 — Shortcuts and keyboard                 | ⏭ Next  |
|                          | M19 — The phone                              |         |

**Last verified:** 2026-11-14, M17 — `pnpm check` green (format, typecheck, lint, 58 unit tests,
build); `pnpm test:e2e` 102 passed (51 checks, each at 2x and 1x).

---

## M0 — A crisp canvas and a render loop ✅

Build:

- [x] Next.js 16 + React 19 + TypeScript 5 (strict), scaffolded with pnpm; shadcn/ui (`radix-lyra`)
      themed with the design file's dark tokens
- [x] ESLint and Prettier as in boyanliu.me (Next rules, Prettier, arrow functions, Tailwind class
      sorting); Vitest and Playwright configured
- [x] Dev and start servers bound to `127.0.0.1` only (port 3021; e2e on 3121)
- [x] Two stacked `<canvas>` elements, `base` and `overlay` —
      `src/components/editor/canvas-stage.tsx`
- [x] DPR sizing on both axes of both canvases — `sizeCanvas` in `src/render/view.ts`
- [x] One `requestAnimationFrame` loop driven by per-layer dirty flags, not a timer —
      `src/render/loop.ts`
- [x] A hard-coded square on `base` (with a one-device-pixel hairline), handles and a pointer
      crosshair on `overlay` (the square was replaced by the M2 test chart)
- [x] A `ResizeObserver` that re-sizes and redraws, plus a re-size when the window moves to a
      display with a different pixel ratio

Check (automated in `e2e/canvas.spec.ts` at 2x and 1x, `src/render/loop.test.ts`,
`tests/architecture.test.ts`):

- [x] Both canvases fill the stage and their backing store is exactly CSS size ×
      `devicePixelRatio`, both axes
- [x] Edges and hairline are sharp: no blended colours across the square, and the square sits at
      the right device-px position (fails at 2x if the ratio is dropped from the transform)
- [x] Resizing the window re-sizes and redraws both canvases (fails if the `ResizeObserver` stops)
- [x] An idle page draws no frames; moving the pointer redraws the overlay, never the base
- [x] No console errors in any browser check
- [x] Already enforcing M2's rule: one `setTransform` in `src/`, in `render/view.ts`, and
      `devicePixelRatio` read nowhere else

Worth a look by eye (not automatable):

- [ ] On your Retina screen, the hairline inside the square is a single sharp line, not soft
- [ ] Drag the window between the laptop screen and an external 1x monitor; with `?debug` the
      readout's ratio and backing store follow (Chrome's emulation can't automate this: it changes the
      ratio without firing the event a real move fires)

Commit: `scaffold: two-canvas render loop with DPR-correct sizing`

## M1 — The editor shell, laid out ✅

Build:

- [x] Switzer self-hosted with `next/font/local`, fetched from Fontshare by
      `scripts/fetch-fonts.mjs` before `dev` and `build`, git-ignored (its licence forbids
      committing it); Geist Mono for readouts
- [x] Lucide icons with the design file's 1.5 px square-capped stroke
- [x] Top bar: wordmark, `Images`, `Shortcuts` — `components/editor/app-bar.tsx`
- [x] Editor bar: filename + natural size, six-tool single-choice group, undo/redo (disabled), zoom
      group, `Export`, `Copy` — `components/editor/editor-bar.tsx`
- [x] `Copy` is the primary button; `Export` is secondary
- [x] The M0 canvas fills the stage, with the status strip under it (`Pointer off`, status line) —
      `components/editor/canvas-stage.tsx`
- [x] Right rail: inspector (six swatches, stroke and opacity sliders, the image-pixel microcopy)
      above the layers list and its reorder hint — `inspector.tsx`, `layer-list.tsx`
- [x] Controls hold UI state only; buttons whose behaviour comes later name their milestone in the
      tooltip
- [x] A strip at the top says the filename, zoom and layers are sample data (`sample.ts`)

Check (automated in `e2e/shell.spec.ts` at 2x and 1x, for the rules that outlast the shell):

- [x] Copy is the one orange button
- [x] The tool and colour groups always keep one choice
- [x] The sliders are named for screen readers, with their units
- [x] No request leaves the app's own host, and Switzer loads from it

Checked once by hand against the design file, not kept as tests (sample data and inert controls
are replaced from M3 on): screen 09's regions in order; 56 px top bar, 320 px rail, 36 px controls,
41 px status strip; the tool row by keyboard; the rail keeping its width as the window shrinks.

Worth a look by eye:

- [ ] Open the app beside `hallmark/index.html#/annotate/3f9a1c07b2e4` at 1440 × 900 and compare

Commit: `shell: screen 09 laid out, controls in place, nothing wired`

## M2 — The coordinate chain · gate ✅

Build:

- [x] `geom/matrix.ts`: `M` from the camera (scale, then pan), `toScreen`, and `toImage` through
      `M`'s inverse; the only module besides the view that builds a matrix
- [x] `geom/camera.ts`: `fit(nat, view)`, whole and centred with 5% breathing room
- [x] The device matrix (`M` with `dpr` in front) built and used only in `render/view.ts`, through
      the one call that sets a transform
- [x] `model/types.ts` opens with: _ALL geometry is image space._
- [x] A generated 3840 × 2407 test chart with landmarks A (2964, 939) and B (640, 1800), drawn
      through the camera at `fit()` (since M3 an e2e fixture, `e2e/files/test-chart.png`)
- [x] The status strip reads the image pixel under the pointer, `x 2964 y 939`, and `Pointer off`
      when it leaves; the zoom readout shows the real fitted scale

Check (`src/geom/*.test.ts`, `tests/architecture.test.ts`, `e2e/canvas.spec.ts` at 2x and 1x):

- [x] The round trip holds within `1e-9` across 5 scales × 3 pixel ratios × a non-zero pan,
      through the whole chain (image → device → screen → image), and `M` is scale-then-pan
- [x] One `setTransform` in `src/`, in `render/view.ts`; `devicePixelRatio` read nowhere else;
      `DOMMatrix` only in `geom/matrix.ts` and `render/view.ts`
- [x] Hovering each landmark where it was painted reads its known coordinates, at 2x and at 1x,
      and again after a resize. Proven by mutation: it fails at 2x (and passes at 1x) when the
      pointer is read through the device matrix, and when the base is painted without the ratio

Worth a look by eye:

- [ ] On your Retina screen, hover A and B and read the strip

Commit: `geom: image/screen/device coordinate chain with invertibility test`

## M3 — Open an image ✅

Build:

- [x] The open screen (01): headline, **Choose an image**, **Open the sample**, the help line, and a
      figure of the sample photo's signature pixel (the corner of boat 14's number, 2136, 2651) at the fitted
      zoom, 400% and 1:1 — `components/open/open-screen.tsx`, `hero.tsx`
- [x] The sample is a landscape, rowboats on Lago di Braies (Luca Bravo, CC0), served from this
      app and credited —
      `model/sample.ts`, `public/samples/`
- [x] Pick, drop anywhere, or paste — `components/open/use-image-input.ts`; the whole page shows
      a drop state while a file is dragged over it (02)
- [x] The format is told from the file's first bytes; PNG, JPEG and WebP decode with
      `createImageBitmap(blob, { imageOrientation: "from-image" })` — `model/image.ts`
- [x] Anything else is refused by name in the help line (03), and focus returns to
      **Choose an image**; a damaged PNG/JPEG/WebP says so
- [x] The editor shows the file's name and natural size; the sample strip and sample layers only
      appear for the sample
- [x] Fixtures in `e2e/files/` (1 px PNG, EXIF-rotated JPEG, HEIC), made by
      `scripts/make-fixtures.mjs`

Check (`src/model/image.test.ts`, `e2e/open.spec.ts` at 2x and 1x):

- [x] Choosing a file opens it at its natural size (`1 × 1 px`)
- [x] The EXIF-rotated photo opens upright: `200 × 400 px`, blue top-left. Proven with `flipY`
      (Chromium now treats `"none"` as `"from-image"`)
- [x] The HEIC is refused with its format named, and the page stays put
- [x] A file dropped anywhere opens, with the drop state showing while it is dragged
- [x] A pasted image opens
- [x] The sample opens from this app, at 4554 × 3036, with its credit
- [x] Format detection from bytes: PNG, JPEG, WebP, HEIC (two brands), AVIF, GIF, TIFF (both byte
      orders), SVG, and unknown

Worth a look by eye:

- [ ] Copy a screenshot (⇧⌘⌃4 on a Mac), open the page, press ⌘V
- [ ] Drag a photo from Finder onto the page

Added after review, at the user's request — the sample opens with annotations drawn:

- [x] Annotation types, the document and the six-colour palette — `model/types.ts`, `doc.ts`,
      `palette.ts`
- [x] `drawScene` with its final signature and four passes; rect, arrow, highlight (multiply), text
      on a plate, live pixelate — `render/scene.ts`, `render/draw/` (render only; drawing them by
      hand is still M5–M14)
- [x] The sample's seven annotations on the photo, also on the open screen's figure; the layer
      list reads them from the document, and the eye button hides one from the canvas
- [x] Check: the sample's annotations are drawn, and hiding one takes it off the canvas (proven by
      passing the unfiltered document, which fails at 2x and 1x)

Commit: `open: dropzone with pick, drop, paste and codec rejection`

## M4 — The annotator states ✅

Build:

- [x] `drawScene(ctx, doc, bitmap, { minVisualStroke })`, the export's function too (done in M3)
- [x] Decoding (08): the editor opens at once; the stage shows the image's frame, dashed, with
      "Decoding 4554 × 3036" (or the file's name before its size is known); Layers shows skeleton
      rows — `components/app.tsx`, `canvas-stage.tsx`
- [x] A file is checked on the open screen first, so a refusal stays there; a decode that
      finishes after going back, or after a newer open, is dropped and its bitmap closed
- [x] Nothing drawn (10): a plate over the image, and **Draw a box** picks the rectangle
- [x] The status line from the document: "7 annotations, last edited 12 Nov 2026, 09:41 UTC." or
      "Nothing drawn yet. Opened …" — `components/editor/status.ts`

Check (`e2e/annotator.spec.ts` at 2x and 1x):

- [x] The image's frame shows while it decodes (the sample held in flight), then the image and the
      status line
- [x] Going back while an image decodes drops it. Proven: it fails without the ticket check
- [x] An image with nothing drawn says so, and **Draw a box** picks the rectangle

Commit: `annotator: decode and empty states, shared drawScene signature`

## M5 — Rectangle, model, selection ✅

Build:

- [x] Document changes in one place, each returning a new document — `model/doc.ts`; outlines and
      painted boxes per kind — `model/bbox.ts`; names and sizes — `model/describe.ts`
- [x] Hit testing, topmost first, 6 screen px of tolerance, unfilled boxes on their frame —
      `geom/hit.ts`
- [x] The interaction machine with the 3 screen-px click-vs-drag threshold — `interact/machine.ts`
- [x] Drawing with the rectangle: the draft draws live, the box is written once on pointer-up and
      selected (screens 12, 13)
- [x] Select by clicking a shape or its layer row; move by dragging; `Delete` / `Backspace` remove
      it; `Esc` drops a gesture in progress, or else the selection
- [x] The selection: hairline outline, eight handles, size tag; the inspector edits it and shows
      X, Y, W, H, with Delete

Check (`src/interact/machine.test.ts`, `src/geom/hit.test.ts`, `e2e/draw.spec.ts` at 2x and 1x):

- [x] Where two boxes overlap, a click selects the top one (fails if the scan order flips)
- [x] A click draws no 0 × 0 box (fails, unit and browser, if a release always draws)
- [x] A box dragged from landmark A to B is recorded in image px and selected
- [x] Dragging a box changes nothing until release, then moves it by image px; `Delete` removes it
- [x] `Esc` drops a box being drawn

Commit: `rect: annotation model, hit testing and the interaction state machine`

## M6 — Resize handles ✅

- [x] `geom/resize.ts`: anchor per handle, flip past the opposite edge with the held handle
      mirrored, shift keeps the aspect on corners
- [x] Handles drawn and hit at 8 screen px at any zoom, on rectangles, highlights and pixelate
      regions; the cursor shows the held handle's direction
- [x] Check: the table (corner, edge, one-axis flip, two-axis flip, shift, shift through a flip),
      handles at 10% and 400%, a handle click changes nothing, and in the browser a corner dragged
      past the opposite one flips the box, in image px

Commit: `resize: eight handles with flip and shift-aspect`

## M7 — Arrow, inspector, undo ✅

- [x] The arrow tool: drag from tail to tip; the head is sized along the shaft and clamped against
      its length, the shaft shortened to meet it — `geom/arrow.ts`; shorter than two strokes is
      discarded on release
- [x] Arrow selection: a handle at each end, the length on the tag, From, To and Length in the
      inspector (screen 20) — `geom/handles.ts`, `render/overlay.ts`, `inspector.tsx`
- [x] The inspector's colour, stroke and opacity edit the selected shape, each an undo step
- [x] Undo by operation, 100 entries: a gesture is one entry, a slider drag is one; ⌘Z and ⇧⌘Z,
      and the Undo and Redo buttons, which name what they step — `history/undo.ts`, `app.tsx`
- [x] Check: arrowheads at 3, 40 and 2000 px finite and in bounds, a 30 px arrow at 11 px stroke is
      half head, the head symmetric at any angle, an arrow's tip handle moves only its tip; undo and redo of add, move, delete and a merged
      slider group; in the browser an arrow from B to A recorded by its ends in image px, and
      draw, move and a slider drag undone one step each, then redone. Proven by mutation: it fails
      when a slider drag isn't grouped, and when a move isn't recorded
- [x] The M5 move check now drags the frame, not the corner (a handle since M6), and checks the
      width is unchanged

Worth a look by eye:

- [ ] Hold ⌘Z after a few drags and watch it step back one drag at a time

Commit: `arrow: shaft geometry, inspector controls and undo by operation`

## M8 — Export and Copy · MVP ✅

- [x] `export/render.ts`: an `OffscreenCanvas` at the natural size, identity transform,
      `document.fonts.ready`, the same `drawScene` with `minVisualStroke: 0`, then `convertToBlob`
- [x] `export/clipboard.ts`: `ClipboardItem` handed the PNG's promise, synchronously from the click
- [x] Copy in the editor bar: "Copied the 3840 × 2407 PNG. Nothing was sent anywhere." (21); without
      a secure page or `ClipboardItem` it becomes **Download PNG** and says why (22); a blocked
      write says so in red and becomes Download PNG (23)
- [x] The export page (25): the PNG itself as the preview with its scale, Output px, Pixels MP,
      Budget MP, **Copy PNG** and **Download PNG**; JPEG and JSON shown, arriving in M16
- [x] Routes for the export and the editor (pulled forward from M10): `#/annotate/:key/export`
- [x] Check (`e2e/export.spec.ts` at 2x and 1x): the copied PNG is 3840 × 2407 at 2x too, with
      the box's stroke on its left edge and not 12 px either side; with no `ClipboardItem` Copy
      downloads a 3840 × 2407 PNG and says why; a blocked clipboard says so; the export page's
      preview is the 3840 × 2407 PNG and Download saves it. Proven by mutation: an export at twice
      the size fails at both ratios

Worth a look by eye — the MVP acceptance test:

- [ ] Draw a box round a known UI element on a 3840 × 2407 screenshot, export, open the PNG in
      Preview at 100% and read its top-left: within 1 px of the editor's
- [ ] Copy, paste into Slack: the image arrives with the box on it
- [ ] In Safari, Copy works (if it fails, the blob was awaited)
- [ ] Over plain `http` from another machine, Copy has become Download PNG with the reason

Commit: `export: natural-size render, PNG encode and clipboard copy — MVP`

## M9 — The library in this browser ✅

- [x] `model/persist.ts`: IndexedDB through `idb`, images and documents keyed by the SHA-256 of
      the bytes (`model/hash.ts`); `model/stored.ts` writes the document as plain data and refuses
      a record it can't read
- [x] "In this browser" under the open page (01): thumbnail, name, size, annotations, last edited,
      **Forget**; loading skeletons (04), the empty state (05), storage blocked (06), Forget asks
      first (07)
- [x] A reload, or a row in the list, opens the image at `#/annotate/:key` with its annotations;
      an address this browser doesn't have says so (32)
- [x] Annotations unreadable (11): the picture shows dimmed, **Try again** and **Start without
      them**, and the layers rail says why
- [x] Saved 400 ms after the last change, and when the image closes
- [x] Check (`src/model/stored.test.ts`, `e2e/library.spec.ts` at 2x and 1x): a document survives
      the trip through storage and one from another version is refused; a reload brings back the
      image and its box; the same bytes under another name open the same record and address;
      with storage blocked an image still opens normally and the list says why; an unknown
      address gives screen 32; Forget keeps the image until confirmed; an unreadable record gives
      screen 11 and Start without them leaves a working editor. Proven by mutation: keying by
      name fails the same-bytes check; blocked storage read as unreadable fails the blocked check

Worth a look by eye:

- [ ] Open the app in a private window: the list explains itself, images still open

Commit: `library: IndexedDB store keyed by image hash, with empty, loading and blocked states`

## M10 — Routes and dead ends ✅

- [x] `lib/route.ts`: the page in the path, the state in the query; `/annotate/` with anything but
      a 12-digit key is screen 32, any other unknown path screen 33 (both with the bare app bar)
- [x] Read when an address opens: `?state=loading|empty|error` and `?drop=heic` on the open page
      (04–06, 03); `?state=loading|error`, `?tool=`, `?select=` and `?clipboard=none|denied` in the
      editor (08, 11, 12, 13, 22, 23); `?clipboard=` on the export page
- [x] The tool and the selection write back to the address without a history entry
- [x] While Copy is a download, the status strip says why from the start (22, 23)
- [x] Check (`e2e/routes.spec.ts` at 2x and 1x): screens 33 and 32 from their addresses; a box's
      address opened in a new tab has the same tool and the same box selected; the open page's
      and the editor's states from their parameters
- [x] Every parameter is read now: `zoom` and `at` from M11, `edit` from M13, several ids in
      `select` from M15, `format` and the export's `state` from M16

Worth a look by eye:

- [ ] Select a box, copy the address, open it in another tab

Commit: `routing: addressable states for every screen`

## M11 — The camera, zoom does not leak ✅

- [x] `geom/camera.ts`: `zoomAt` reads the image point under the cursor before the scale changes,
      clamped to 10%–800%; the view's state is `"fit"` or a scale and the image point at its centre
- [x] The wheel and pinch zoom at the pointer; a trackpad's two fingers, Space-drag and the middle
      button pan, whatever the tool — `components/editor/use-camera.ts`, `canvas-stage.tsx`
- [x] Zoom out, zoom in (×1.25), Fit and 1:1 in the editor bar; the readout pairs the percentage
      with the size, `400% · 4554 × 3036`; `?zoom=&at=` opens at a view and is written back once it
      settles
- [x] Already in place: smoothing off above 200%, hit tolerance and handles in screen px,
      `minVisualStroke` 1 / scale in the view and 0 in the export
- [x] Check (`src/geom/camera.test.ts`, `e2e/camera.spec.ts` at 2x and 1x): `zoomAt` keeps the
      cursor's image point zooming in, out and at the clamp; **the sample copied at the fitted zoom
      and at 244% is the same PNG, byte for byte**; the wheel keeps the pixel under the pointer, and
      the zoom survives a reload through the address; Space-drag and the middle button pan by the
      drag and draw nothing with the rectangle chosen. Proven by mutation: copying from the view
      canvas fails the byte check; zooming about the origin fails the unit test
- [x] Screen px reach no annotation: they are read only for the readout, the crosshair, the pan
      and the 3 px drag threshold; every effect that changes the document carries image points

Worth a look by eye:

- [ ] At 25%, box two landmarks and export; undo, at 400% box the same two and export: the PNGs
      agree within 1 px, strokes identical
- [ ] Pinch on a trackpad and two-finger scroll: one zooms at the fingers, the other pans

Commit: `camera: cursor-anchored zoom and pan, with zoom-independence proven`

## M12 — Highlight and the four-pass compositor ✅

- [x] Four passes in `drawScene` since M3: the image, pixelate, highlights (multiply), the rest
- [x] The highlighter draws a box; red, the default, becomes yellow — `interact/draft.ts`
- [x] Check (`src/interact/draft.test.ts`, `e2e/highlight.spec.ts` at 2x and 1x): a highlight across
      an arrow's shaft leaves the shaft's pixel unchanged and multiplies the ground under it.
      Proven by mutation: drawing highlights in paint order fails it

Worth a look by eye:

- [ ] Highlight a line of text in a screenshot: it stays readable

Commit: `highlight: multiply pass ordered before opaque annotations`

## M13 — Text that exports identically ✅

- [x] `render/text-layout.ts`: one shared measuring context, widths cached by font and string,
      greedy wrap against the label's width, a fixed 1.25 line height
- [x] The text tool opens a label in a textarea over the canvas (screen 17), placed from each
      frame's camera; a double-click or **Edit text** reopens one; blur or ⌘Enter commits, Esc
      cancels, `?edit=<id>` opens one from the address — `components/editor/text-editor.tsx`
- [x] A handle on a label's right edge sets its wrap width; the inspector adds Size and the plate
- [x] Check (`e2e/text.spec.ts` at 2x and 1x): a label written, listed by its words, edited in
      place, reopened from the address after a reload, and left as it was by Esc; narrowing it by
      its handle wraps it onto more lines

Worth a look by eye:

- [ ] Write a 40-word label with the plate, export it, and compare the line breaks with the screen
- [ ] Drag a long label around: no drop in frame rate

Commit: `text: wrapped canvas text with plate and DOM editing overlay`

## M14 — Pixelate, kept live ✅

- [x] A region stores its box and block size, and is recomputed from the source on every draw,
      in the pass before highlights (since M3)
- [x] The pixelate tool, with blocks of width ÷ 280 (at least 8 px), and a Block slider
- [x] Check (`e2e/pixelate.spec.ts` at 2x and 1x): with an arrow drawn first and a region over it,
      the copied PNG's blocks are one colour each and the arrow under the region stays red; after a
      reload the region is selected from the address and its block size changes. Proven by
      mutation: drawing pixelate in paint order fails it

Worth a look by eye:

- [ ] Pixelate a face, export, and zoom into the PNG: the detail is gone, not blurred

Commit: `pixelate: live redaction recomputed from source each render`

## M15 — Layers and multi-select ✅

- [x] The selection is a list: Shift-click adds or removes, `?select=` holds every id
- [x] A marquee on empty ground with the select tool picks what it touches (screen 15)
- [x] A group: the box around it with eight handles, members dashed, moved, resized and deleted
      as one; the inspector's colour, X/Y/W/H and Delete N (screen 16)
- [x] Paint order by dragging a layer row, ⌥↑/⌥↓, or Forward and Backward
- [x] Check (`src/interact/machine.test.ts`, `src/geom/handles.test.ts`, `e2e/layers.spec.ts` at
      2x and 1x): Shift adds and a drag moves the lot; a marquee is a drag on empty ground; a group
      resize carries its members; three boxes marqueed, moved, and put back by one ⌘Z; a dragged row
      changes which crossing frame is on top, and ⌥↓ steps it back; a hidden box is not in the PNG.
      Proven by mutation: a move recorded per member, and an export with hidden layers, both fail

Worth a look by eye:

- [ ] Eight annotations list with image-px sizes that match the inspector's

Commit: `layers: z-order list, visibility and marquee multi-select`

## M16 — Export, the whole page ✅

- [x] PNG to copy or download, JPEG to download with a quality slider, annotations as W3C Web
      Annotation JSON to copy or download (screens 26, 27)
- [x] A JSON file dropped on the editor puts its annotations back onto the image it names
- [x] `export/limits.ts`: a 64 MP budget and 16,384 px a side; over it the export is drawn smaller
      by one factor and says so (28); drawing (29), nothing drawn (30) and an unreadable image (31)
- [x] Check (`src/export/annotations.test.ts`, `e2e/export-formats.spec.ts` at 2x and 1x): JSON
      round-trips and is refused for another image; exported JSON dropped back on the editor puts a
      deleted box back where it was; a 72 MP image exports at 11313 × 5656 with its corner still in
      the corner; JPEG downloads as a JPEG and has no Copy; the states come from the address. Proven
      by mutation: a render that forgets to scale fails the corner

Worth a look by eye:

- [ ] Export a JPEG at 50% and at 100% and compare the file sizes

Commit: `export: formats, limits and honest degradation`

## M17 — Out of bounds ✅

- [x] The overlay dims the stage outside the image
- [x] A badge when anything runs past the edge, with Select it / Select them (screen 19)
- [x] No clamping; Fit takes in what is past the edge, measured on open and on Fit only
- [x] Check (`e2e/bounds.spec.ts` at 2x and 1x): an arrow drawn out past the top raises the badge;
      the overlay is dimmed outside the image and clear inside it; drawing it doesn't move the view;
      Select it selects it; Fit then zooms out to take it in

Worth a look by eye:

- [ ] Export with an arrow half outside: the PNG is the image's size, the arrow cut at the edge

Commit: `bounds: out-of-bounds gutter and badge`
