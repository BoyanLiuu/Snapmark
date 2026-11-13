import type { Page } from "@playwright/test";
import { LANDMARKS, LANDMARK_SIDE } from "./chart";
import { expect, test } from "./fixtures";
import { findPainted, openChart } from "./helpers";

/**
 * The render loop (M0) and the coordinate chain (M2), at 2x and at 1x (see playwright.config.ts):
 * the device-pixel bugs are invisible at 1x and certain at 2x.
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
 * Hover where each landmark was painted and read the image pixel the app reports there. This is
 * the whole chain in a real browser: painting goes image → device px, the pointer comes back
 * screen → image px, and the two only agree if the pixel ratio is in the first and not the second.
 */
const expectLandmarksRead = async (page: Page) => {
  const canvas = page.locator('canvas[data-layer="overlay"]');
  const readout = page.getByTestId("cursor-readout");
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  for (const { name, x, y, colour } of LANDMARKS) {
    await expect
      .poll(() => findPainted(page, colour), `${name} is painted`)
      .not.toBeNull();
    const painted = (await findPainted(page, colour))!;
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + painted.x / dpr, box.y + painted.y / dpr);
    // One screen px covers this many image px at the fitted zoom; the readout may be off by that.
    const imagePxPerScreenPx = LANDMARK_SIDE / (Math.sqrt(painted.count) / dpr);
    const tolerance = Math.ceil(imagePxPerScreenPx) + 1;
    await expect
      .poll(async () => {
        const match = (await readout.textContent())?.match(
          /x\s(-?\d+)\sy\s(-?\d+)/,
        );
        if (!match) return Infinity;
        return Math.max(
          Math.abs(Number(match[1]) - x),
          Math.abs(Number(match[2]) - y),
        );
      }, `${name} reads x ${x} y ${y}`)
      .toBeLessThanOrEqual(tolerance);
  }
  await page.mouse.move(1, 1);
  await expect(readout).toHaveText("Pointer off");
};

const stat = async (
  page: Page,
  name: "frames" | "base-draws" | "overlay-draws",
) => Number(await page.getByTestId("stage").getAttribute(`data-${name}`));

/** The first frame has drawn, the chart is on it, and nothing scheduled is still pending. */
const settle = async (page: Page) => {
  await expect(page.getByTestId("stage")).toHaveAttribute(
    "data-frames",
    /^[1-9]/,
  );
  await expect
    .poll(() => findPainted(page, LANDMARKS[0].colour))
    .not.toBeNull();
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
};

test.beforeEach(async ({ page }) => {
  await openChart(page);
  await settle(page);
});

test("the canvases are sized to the display", async ({ page }, testInfo) => {
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(
    testInfo.project.use.deviceScaleFactor,
  );
  await expectSized(page);
});

test("each landmark reads its own image pixel under the pointer", async ({
  page,
}) => {
  await expectLandmarksRead(page);
});

test("after a resize, the canvases re-size and the landmarks still read true", async ({
  page,
}) => {
  const [before] = await canvasSizes(page);
  await page.setViewportSize({ width: 900, height: 640 });
  await expect
    .poll(async () => (await canvasSizes(page))[0].cssW)
    .toBeLessThan(before.cssW);
  await settle(page);
  await expectSized(page);
  await expectLandmarksRead(page);
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
