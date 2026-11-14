# Snapmark

Annotate to the pixel, then paste. Open a screenshot, draw a box or an arrow on it, and copy a PNG
at the image's own size. Nothing leaves the browser.

The plan and the architecture are in [`docs/`](docs/); the screens it builds to come from a
Hallmark design file that is not in this repo yet.

**Status:** all of M0–M19 done. Open an image, zoom to the pixel, draw boxes, arrows,
highlights and labels, pixelate what must not show, select several and reorder layers, undo, then
Copy a PNG, or export a PNG, a JPEG or the annotations as JSON, at the image's own size and the same
bytes at any zoom; warned first if anything runs past the edge, by keyboard or on a phone too.
See [MILESTONES.md](MILESTONES.md).

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

Add shadcn components with `pnpm dlx shadcn@latest add <name>`, then `pnpm exec eslint --fix
src/components/ui` to turn their `function` declarations into arrow functions.

## Layout

```
src/
  app/                  Next.js: layout, page, globals.css (the design file's tokens)
  components/ui/        shadcn primitives
  components/app.tsx    the open page, the editor or the export page, by address (use-session.ts)
  components/session-store.ts  the open image, its history, the tool and selection (Zustand)
  components/open/      the open screen: pick, drop, paste, the hero lenses, the library (screen 32 too)
  components/export/    the export page
  components/editor/    the editor: app bar, editor bar, canvas stage, inspector, layers
  model/types.ts        ALL geometry is image space: the annotation types
  model/doc.ts          the document: annotations by id, in paint order
  model/palette.ts      the six colours
  model/image.ts        format from bytes, decode upright
  model/sample.ts       the sample photo (public/samples/) and its annotations
  model/persist.ts      IndexedDB: images and documents by the hash of the bytes (hash.ts, stored.ts)
  model/schema.ts       Zod schemas for annotations from outside the app, checked against their types
  export/               render.ts (the PNG at natural size), clipboard.ts (Copy, or Download)
  geom/                 matrix.ts (M, toScreen, toImage), camera.ts (fit), arrow.ts, hit.ts,
                        resize.ts, handles.ts
  interact/             machine.ts (press, move, release, preview), draft.ts (what a drag draws)
  history/undo.ts       undo by operation
  render/               view.ts (the only code that knows device pixels), loop.ts, overlay.ts,
                        scene.ts (drawScene, shared with the export from M8), draw/ (per kind)
scripts/                fetch-fonts.mjs, make-fixtures.mjs (the e2e/files images and test chart)
tests/                  repo-wide architecture checks
e2e/                    Playwright
docs/                   IMPLEMENTATION_PLAN.md, ARCHITECTURE.md
```

The one rule to keep: **all annotation geometry is stored in image pixels**, and only
`src/render/view.ts` knows about device pixels. `tests/architecture.test.ts` fails if a canvas
transform or `devicePixelRatio` appears anywhere else.

## Credits

The sample photo, `public/samples/lago-di-braies.webp`, is
[“Lago di Braies”](<https://commons.wikimedia.org/wiki/File:Lago_di_Braies_(Unsplash_VowIFDxogG4).jpg>)
by [Luca Bravo](https://unsplash.com/@lucabravo), from Unsplash via Wikimedia Commons,
[CC0](https://creativecommons.org/publicdomain/zero/1.0/), re-encoded as WebP. No credit is
required; see `public/samples/CREDITS.txt`.
