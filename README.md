# Snapmark

Annotate to the pixel, then paste. Open a screenshot, draw a box or an arrow on it, and copy a PNG
at the image's own size. Nothing leaves the browser.

The plan and the architecture are in [`docs/`](docs/); the screens it builds to come from a
Hallmark design file that is not in this repo yet.

**Status:** M0–M1 of M0–M19 done: the editor is laid out around a working canvas, nothing is wired
yet. See [MILESTONES.md](MILESTONES.md).

## Stack

Next.js 16 (App Router, client-only), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide icons,
Canvas 2D by hand. Vitest for units, Playwright for the browser checks.

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
  components/editor/    the editor: app bar, editor bar, canvas stage, inspector, layers
                        (sample.ts holds the design file's sample data until M3 and M15)
  render/               view.ts (the only code that knows device pixels), loop.ts, demo.ts
scripts/                fetch-fonts.mjs
tests/                  repo-wide architecture checks
e2e/                    Playwright
docs/                   IMPLEMENTATION_PLAN.md, ARCHITECTURE.md
```

The one rule to keep: **all annotation geometry is stored in image pixels**, and only
`src/render/view.ts` knows about device pixels. `tests/architecture.test.ts` fails if a canvas
transform or `devicePixelRatio` appears anywhere else.
