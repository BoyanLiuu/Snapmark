import type { Page } from "@playwright/test";
import { CHART_SIZE } from "./chart";
import { expect, test } from "./fixtures";
import { drag, openChart } from "./helpers";

/** M17: the export clips at the image's edge silently, so the editor says so first. */

const percent = async (page: Page) =>
  Number(
    (await page.getByTestId("zoom-readout").textContent())?.match(
      /^(\d+)%/,
    )?.[1],
  );

/** The overlay's opacity at a page point: the gutter dims the stage outside the image. */
const overlayAlpha = (page: Page, at: { x: number; y: number }) =>
  page.evaluate(
    ([x, y]) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        'canvas[data-layer="overlay"]',
      )!;
      const box = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      return canvas
        .getContext("2d")!
        .getImageData(
          Math.round((x - box.x) * dpr),
          Math.round((y - box.y) * dpr),
          1,
          1,
        ).data[3];
    },
    [at.x, at.y] as const,
  );

test("an arrow past the image's edge is dimmed outside it and named; Select it picks it, and Fit takes it in", async ({
  page,
}) => {
  await openChart(page);
  await expect(page.getByTestId("zoom-readout")).toHaveText(/^\d+%/);
  const fitted = await percent(page);
  const stage = (await page
    .locator('canvas[data-layer="overlay"]')
    .boundingBox())!;
  const scale =
    Math.min(stage.width / CHART_SIZE.w, stage.height / CHART_SIZE.h) * 0.95;
  const left = stage.x + (stage.width - CHART_SIZE.w * scale) / 2;
  const middle = stage.y + stage.height / 2;

  // From inside the image to well above it: the pointer is captured, so it can leave the stage.
  await page.getByRole("radio", { name: "Arrow" }).click();
  await drag(
    page,
    { x: left + 120, y: middle },
    { x: left + 120, y: stage.y - 150 },
  );
  const badge = page.getByRole("status").filter({ hasText: "past the edge" });
  await expect(badge).toHaveText(
    /^1 annotation runs past the edge\. The PNG cuts it off\./,
  );

  // Off the stage, so neither the crosshair nor the pointer is on the overlay.
  await page.mouse.move(stage.x + stage.width / 2, stage.y - 30);
  expect(
    await overlayAlpha(page, { x: stage.x + 2, y: stage.y + 20 }),
  ).toBeGreaterThan(150);
  expect(
    await overlayAlpha(page, { x: left + 300, y: stage.y + stage.height / 4 }),
  ).toBe(0);

  // Drawing it didn't move the view: only Fit takes it in.
  expect(await percent(page)).toBe(fitted);
  await page.keyboard.press("Escape");
  await badge.getByRole("button", { name: "Select it" }).click();
  await expect(page.getByRole("heading", { name: "Arrow" })).toBeVisible();

  await page.getByRole("button", { name: "Fit" }).click();
  await expect.poll(() => percent(page)).toBeLessThan(fitted);
});
