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
|                          | M2 — The coordinate chain · **gate**         | ⏭ Next  |
| B · The paste loop       | M3 — Open an image                           |         |
|                          | M4 — The annotator states                    |         |
|                          | M5 — Rectangle, model, selection             |         |
|                          | M6 — Resize handles                          |         |
|                          | M7 — Arrow, inspector, undo                  |         |
|                          | M8 — Export and Copy · **MVP**               |         |
| C · Kept and addressable | M9 — The library in this browser             |         |
|                          | M10 — Routes and dead ends                   |         |
| D · The learning goals   | M11 — The camera, zoom does not leak         |         |
|                          | M12 — Highlight and the four-pass compositor |         |
|                          | M13 — Text that exports identically          |         |
|                          | M14 — Pixelate, kept live                    |         |
| E · The whole flow board | M15 — Layers and multi-select                |         |
|                          | M16 — Export, the whole dialog               |         |
|                          | M17 — Out of bounds                          |         |
|                          | M18 — Shortcuts and keyboard                 |         |
|                          | M19 — The phone                              |         |

**Last verified:** 2026-11-13, M4 — `pnpm check` green (format, typecheck, lint, 22 unit tests,
build); `pnpm test:e2e` 38 passed (5 canvas, 4 shell, 7 open and 3 annotator checks, each at 2x
and 1x).

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
