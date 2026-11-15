# Snapmark

Annotate to the pixel, then paste. Open a screenshot or a photo, draw on it, and copy a PNG at the
image's own size. Nothing leaves the browser: no account, no upload, no server.

![The open screen: the headline, and the sample photo annotated with a box, an arrow and two labels,
with the view's zoom and the selected box's size and top-left corner read out beneath
it.](docs/screenshot.webp)

Every coordinate is stored in the source image's own pixels, so a box drawn at 25% zoom and the
same box drawn at 400% export as the same bytes. The design it is built to comes from a Hallmark
design file that is not in this repo; the architecture is in [`docs/`](docs/).

## What it does

- **Six tools:** select, rectangle, arrow, highlighter (which multiplies, so what is under it stays
  readable), text labels on a legibility plate, and a pixelate region recomputed from the original
  on every draw, so it stays editable.
- **Zoom to the pixel:** 10% to 800%, anchored at the pointer, with the image's pixel grid showing
  past 200%. Space-drag, the middle button or two fingers pan.
- **Edit what you drew:** select one or several, move, resize by eight handles, nudge by a pixel,
  reorder the layers, hide any of them, and undo by operation — one drag, one step.
- **Copy and export:** `⌘C` puts the PNG on the clipboard at the image's own size, or downloads it
  where the browser has no clipboard to offer; the export page
  also offers a JPEG, or the annotations as W3C Web Annotation JSON, which can be dropped back onto
  the same image. Over a 64 MP budget it scales down and says so, rather than handing back a blank
  file.
- **Kept in this browser:** each image and its annotations are filed under the SHA-256 of its bytes
  in IndexedDB, so opening the same file again brings its annotations back, whatever it is called.
- **Dark or light:** the design is dark and that is what you get until you switch, in the app bar;
  the choice is kept. Only the chrome changes — the annotations and their plates are content, so an
  export is the same bytes either way.
- **Reachable by address, keyboard and phone:** every screen has a URL, every shortcut the panel
  lists works, and the whole loop fits a 375 px viewport by touch.

## Stack

Next.js 16 (App Router, client-only), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide icons,
Canvas 2D by hand. Zustand holds the open image and the editor's state, Zod checks data from outside
the app, `idb` keeps the library in IndexedDB. Vitest for units, Playwright for the browser checks.

**Fonts.** Switzer's licence allows self-hosting but not committing the files, so
`scripts/fetch-fonts.mjs` downloads them from Fontshare into `src/assets/fonts/switzer/`
(git-ignored) the first time you run `dev` or `build`, and the app serves them itself. The first run
needs a network connection; `pnpm fonts` fetches them on their own.

## Commands

Uses pnpm through corepack (`corepack enable`, or prefix each command with `corepack`).

| Command           | What it does                                                                    |
| ----------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`        | Dev server on http://127.0.0.1:3021 (`/?debug` shows the render loop's readout) |
| `pnpm check`      | Format check, typecheck, lint, unit tests, production build                     |
| `pnpm test:e2e`   | Builds to `.next-e2e`, then runs the browser checks at 2x and 1x                |
| `pnpm test:watch` | Vitest in watch mode                                                            |
| `pnpm format`     | Prettier, with Tailwind class sorting                                           |
| `pnpm icons`      | Redraws `src/app/apple-icon.png` from `src/app/icon.svg`                        |

Add shadcn components with `pnpm dlx shadcn@latest add <name>`, then `pnpm exec eslint --fix
src/components/ui` to turn their `function` declarations into arrow functions.

## Layout

```
src/
  app/                  Next.js: layout, page, globals.css (the design file's tokens),
                        icon.svg (the tab icon; apple-icon.png is drawn from it)
  components/ui/        shadcn primitives
  components/app.tsx    the open page, the editor or the export page, by address (use-session.ts)
  components/session-store.ts  the open image, its history, the tool and selection (Zustand)
  components/open/      the open screen: pick, drop, paste, the figure's lenses and the intro it
                        draws on itself (intro.ts), the library, and the dead ends
  components/export/    the export page
  components/editor/    the editor: app bar, editor bar, canvas stage, inspector, layers
                        (hint.tsx: what a control does, on hover and on focus)
  model/types.ts        ALL geometry is image space: the annotation types
  model/doc.ts          the document: annotations by id, in paint order
  model/palette.ts      the six colours
  model/image.ts        format from bytes, decode upright
  model/sample.ts       the sample photo (public/samples/) and its annotations
  model/persist.ts      IndexedDB: images and documents by the hash of the bytes (hash.ts, stored.ts)
  model/schema.ts       Zod schemas for annotations from outside the app, checked against their types
  export/               render.ts (the image at natural size), clipboard.ts (Copy, or Download),
                        limits.ts (the engines' caps), annotations.ts (the JSON)
  geom/                 matrix.ts (M, toScreen, toImage), camera.ts (fit), arrow.ts, hit.ts,
                        resize.ts, handles.ts
  interact/             machine.ts (press, move, release, preview), draft.ts (what a drag draws)
  history/undo.ts       undo by operation
  render/               view.ts (the only code that knows device pixels), loop.ts, overlay.ts,
                        scene.ts (drawScene, shared with the export), draw/ (per kind)
  lib/                  route.ts (the addresses), store.ts, animate.ts, debounce.ts, text.ts
scripts/                fetch-fonts.mjs, make-fixtures.mjs (the e2e/files images and test chart),
                        make-icons.mjs
e2e/                    Playwright
docs/                   IMPLEMENTATION_PLAN.md, ARCHITECTURE.md, screenshot.webp
```

The one rule to keep: **all annotation geometry is stored in image pixels**, and only
`src/render/view.ts` knows about device pixels — anything else that folds in the pixel ratio is the
bug that reproduces on a Retina laptop and nowhere else. It is a rule to hold by hand: the grep
test that enforced it was removed when the hero's wordmark (`components/open/tech-text.tsx`, which
draws no annotations) brought its own canvas transform.

## Credits

The sample photo, `public/samples/lago-di-braies.webp`, is
[“Lago di Braies”](<https://commons.wikimedia.org/wiki/File:Lago_di_Braies_(Unsplash_VowIFDxogG4).jpg>)
by [Luca Bravo](https://unsplash.com/@lucabravo), from Unsplash via Wikimedia Commons,
[CC0](https://creativecommons.org/publicdomain/zero/1.0/), re-encoded as WebP. No credit is
required; see `public/samples/CREDITS.txt`.
