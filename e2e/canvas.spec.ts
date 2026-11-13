import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * M0's checks, at 2x and at 1x (see playwright.config.ts): the device-pixel bugs that are invisible
 * at 1x and certain at 2x. The square comes from render/demo.ts; M2 replaces it with a test chart,
 * and these pixel checks with checks against the chart.
 */

const canvasSizes = (page: Page) =>
  page.evaluate(() =>
    ["base", "overlay"].map((layer) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        `canvas[data-layer="${layer}"]`,
      )!;
      const rect = canvas.getBoundingClientRect();
      const container = canvas.parentElement!.getBoundingClientRect();
      return {
        layer,
        width: canvas.width,
        height: canvas.height,
        cssW: rect.width,
        cssH: rect.height,
        // The view floors the container to whole CSS px.
        containerW: Math.floor(container.width),
        containerH: Math.floor(container.height),
        dpr: window.devicePixelRatio,
      };
    }),
  );

/** Each canvas fills its container, and its backing store is exactly that × devicePixelRatio. */
const expectSized = async (page: Page) => {
  for (const c of await canvasSizes(page)) {
    expect(c.cssW, `${c.layer} fills the stage`).toBe(c.containerW);
    expect(c.cssH, `${c.layer} fills the stage`).toBe(c.containerH);
    expect(c.width, `${c.layer} width`).toBe(Math.round(c.cssW * c.dpr));
    expect(c.height, `${c.layer} height`).toBe(Math.round(c.cssH * c.dpr));
  }
};

/**
 * The base canvas's middle row, through the square and its hairline: the distinct RGBA values on
 * it, and where the drawing starts and ends, in device px.
 */
const middleRow = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-layer="base"]',
    )!;
    const ctx = canvas.getContext("2d")!;
    const row = ctx.getImageData(
      0,
      Math.floor(canvas.height / 2),
      canvas.width,
      1,
    ).data;
    const colours = new Set<string>();
    let first = -1;
    let last = -1;
    for (let i = 0; i < row.length; i += 4) {
      colours.add(row.slice(i, i + 4).join(","));
      if (row[i + 3] > 0) {
        if (first < 0) first = i / 4;
        last = i / 4;
      }
    }
    return { colours: [...colours], first, last };
  });

/** Sharp and in the right place: also catches a pixel ratio missing from the canvas transform. */
const expectCrispSquare = async (page: Page) => {
  const { colours, first, last } = await middleRow(page);
  // Transparent, the orange frame, the fill and the hairline. A soft edge or a smeared hairline
  // would add blended values.
  expect(colours.length, colours.join(" | ")).toBeLessThanOrEqual(4);
  // The 240 CSS px square plus its frame's outer CSS px each side, centred on whole CSS px.
  const [{ cssW, dpr }] = await canvasSizes(page);
  expect(first).toBe((Math.round((cssW - 240) / 2) - 1) * dpr);
  expect(last - first + 1).toBe(242 * dpr);
};

const stat = async (
  page: Page,
  name: "frames" | "base-draws" | "overlay-draws",
) =>
  Number(await page.getByTestId("render-stats").getAttribute(`data-${name}`));

const settle = async (page: Page) => {
  // The strip carries the counters once the first frame has drawn.
  await expect(page.getByTestId("render-stats")).toHaveAttribute(
    "data-frames",
    /^[1-9]/,
  );
  // Two animation frames, so anything already scheduled has drawn.
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await settle(page);
});

test("the canvases are sized to the display, and the square is sharp", async ({
  page,
}, testInfo) => {
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(
    testInfo.project.use.deviceScaleFactor,
  );
  await expectSized(page);
  await expectCrispSquare(page);
});

test("resizing the window re-sizes and redraws the canvases", async ({
  page,
}) => {
  const [before] = await canvasSizes(page);
  await page.setViewportSize({ width: 900, height: 640 });
  await expect
    .poll(async () => (await canvasSizes(page))[0].cssW)
    .toBeLessThan(before.cssW);
  await settle(page);
  await expectSized(page);
  await expectCrispSquare(page);
});

test("an idle page draws no frames", async ({ page }) => {
  const before = await stat(page, "frames");
  await page.waitForTimeout(750);
  expect(await stat(page, "frames")).toBe(before);
});

test("moving the pointer redraws the overlay, never the base", async ({
  page,
}) => {
  const base = await stat(page, "base-draws");
  const overlay = await stat(page, "overlay-draws");
  const box = (await page
    .locator('canvas[data-layer="overlay"]')
    .boundingBox())!;
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(box.x + 40 * i, box.y + 30 * i);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await expect.poll(() => stat(page, "overlay-draws")).toBeGreaterThan(overlay);
  expect(await stat(page, "base-draws")).toBe(base);
});
