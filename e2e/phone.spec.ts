import type { Page } from "@playwright/test";
import { LANDMARKS } from "./chart";
import { expect, test } from "./fixtures";
import { onPage, openChart } from "./helpers";

/** M19: the open page, the editor and the export page on a 375 px phone, by touch. */

test.use({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
});

const [A] = LANDMARKS;

const fitsTheWidth = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375);

/** A finger on the stage, as the browser reports one: a pointer event of type touch. */
const finger = (
  page: Page,
  type: string,
  id: number,
  at: { x: number; y: number },
) =>
  page.dispatchEvent('canvas[data-layer="overlay"]', type, {
    pointerId: id,
    pointerType: "touch",
    isPrimary: id === 1,
    clientX: at.x,
    clientY: at.y,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  });

const percent = async (page: Page) =>
  Number(
    (await page.getByTestId("zoom-readout").textContent())?.match(
      /^(\d+)%/,
    )?.[1],
  );

test("the open page, the editor and the export page fit a phone's width; the editor stacks", async ({
  page,
}) => {
  await page.goto("/");
  await fitsTheWidth(page);
  await openChart(page);
  await fitsTheWidth(page);
  const stage = (await page.getByTestId("stage").boundingBox())!;
  const inspector = (await page
    .getByRole("heading", { name: "New annotations" })
    .boundingBox())!;
  expect(inspector.y).toBeGreaterThan(stage.y + stage.height);
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Export /);
  await fitsTheWidth(page);
});

test("one finger on empty ground pans, and two fingers pinch to zoom", async ({
  page,
}) => {
  await openChart(page);
  await expect(page.getByTestId("zoom-readout")).toHaveText(/^\d+%/);
  const before = await onPage(page, A);
  const stage = (await page.getByTestId("stage").boundingBox())!;
  const c = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };

  await finger(page, "pointerdown", 1, c);
  await finger(page, "pointermove", 1, { x: c.x + 40, y: c.y + 20 });
  await finger(page, "pointerup", 1, { x: c.x + 40, y: c.y + 20 });
  await expect
    .poll(async () => {
      const now = await onPage(page, A);
      return Math.max(
        Math.abs(now.x - before.x - 40),
        Math.abs(now.y - before.y - 20),
      );
    })
    .toBeLessThanOrEqual(1.5);

  const fitted = await percent(page);
  await finger(page, "pointerdown", 1, { x: c.x - 40, y: c.y });
  await finger(page, "pointerdown", 2, { x: c.x + 40, y: c.y });
  await finger(page, "pointermove", 2, { x: c.x + 120, y: c.y });
  await finger(page, "pointerup", 2, { x: c.x + 120, y: c.y });
  await finger(page, "pointerup", 1, { x: c.x - 40, y: c.y });
  // The fingers went from 80 to 160 px apart: twice the zoom.
  await expect.poll(() => percent(page)).toBeGreaterThanOrEqual(fitted * 2 - 1);
});
