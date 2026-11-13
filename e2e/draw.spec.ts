import type { Page } from "@playwright/test";
import { LANDMARKS } from "./chart";
import { expect, test } from "./fixtures";
import { findPainted, openChart } from "./helpers";

/**
 * M5: draw a box, select it, move it, delete it. Landmarks give known image points, so what the
 * app records can be checked in image px, at 2x and at 1x.
 */

const [A, B] = LANDMARKS;

/** Where a landmark is on the page, in CSS px. */
const onPage = async (page: Page, landmark: (typeof LANDMARKS)[number]) => {
  await expect.poll(() => findPainted(page, landmark.colour)).not.toBeNull();
  const painted = (await findPainted(page, landmark.colour))!;
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const box = (await page
    .locator('canvas[data-layer="overlay"]')
    .boundingBox())!;
  return { x: box.x + painted.x / dpr, y: box.y + painted.y / dpr };
};

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
};

const field = async (page: Page, name: "x" | "y" | "w" | "h") =>
  Number(await page.getByTestId(`box-${name}`).textContent());

const count = (page: Page) =>
  page.getByRole("complementary").getByText(/^\d+ annotations?$/);

test.beforeEach(async ({ page }) => {
  await openChart(page);
  await page.getByRole("radio", { name: "Rectangle" }).click();
});

test("a box dragged from landmark A to B is recorded in image px, and selected", async ({
  page,
}) => {
  const a = await onPage(page, A);
  const b = await onPage(page, B);
  await drag(page, a, b);
  await expect(page.getByRole("heading", { name: "Rectangle" })).toBeVisible();
  // One screen px is about 5 image px at this fit, and each landmark is found to within one.
  const near = async (name: "x" | "y" | "w" | "h", value: number) =>
    expect(
      Math.abs((await field(page, name)) - value),
      name,
    ).toBeLessThanOrEqual(8);
  await near("x", B.x);
  await near("y", A.y);
  await near("w", A.x - B.x);
  await near("h", B.y - A.y);
  await expect(count(page)).toHaveText("1 annotation");
});

test("a click draws nothing, and Esc drops a box being drawn", async ({
  page,
}) => {
  const a = await onPage(page, A);
  await page.mouse.click(a.x, a.y);
  await expect(count(page)).toHaveText("0 annotations");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x - 120, a.y + 80, { steps: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(count(page)).toHaveText("0 annotations");
});

test("a box moves by dragging its frame, the document changing only on release, and deletes", async ({
  page,
}) => {
  const a = await onPage(page, A);
  const b = await onPage(page, B);
  await drag(page, a, b);
  await page.getByRole("radio", { name: "Select" }).click();
  const x = await field(page, "x");
  const scale = (a.x - b.x) / (A.x - B.x);

  // B is the box's bottom-left corner, on its frame.
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(b.x + 100, b.y, { steps: 8 });
  expect(await field(page, "x"), "untouched mid-drag").toBe(x);
  await page.mouse.up();
  await expect
    .poll(() => field(page, "x"))
    .toBeGreaterThan(x + 100 / scale - 8);

  await page.keyboard.press("Delete");
  await expect(count(page)).toHaveText("0 annotations");
});
