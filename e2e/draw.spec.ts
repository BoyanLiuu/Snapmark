import type { Page } from "@playwright/test";
import { LANDMARKS } from "./chart";
import { expect, test } from "./fixtures";
import { findPainted, openChart } from "./helpers";

/**
 * M5–M7: draw a box or an arrow, select, move, resize and delete it, and undo each step.
 * Landmarks give known image points, so what the app records can be checked in image px, at 2x
 * and at 1x.
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

/** A point on the bottom of the box from A to B, a quarter of the way along: frame, not handle. */
const onFrame = (a: { x: number }, b: { x: number; y: number }) => ({
  x: b.x + (a.x - b.x) / 4,
  y: b.y,
});

const field = async (page: Page, name: "x" | "y" | "w" | "h") =>
  Number(await page.getByTestId(`fact-${name}`).textContent());

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
  const w = await field(page, "w");
  const scale = (a.x - b.x) / (A.x - B.x);

  const from = onFrame(a, b);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 100, from.y, { steps: 8 });
  expect(await field(page, "x"), "untouched mid-drag").toBe(x);
  await page.mouse.up();
  await expect
    .poll(() => field(page, "x"))
    .toBeGreaterThan(x + 100 / scale - 8);
  expect(await field(page, "w"), "moved, not resized").toBe(w);

  await page.keyboard.press("Delete");
  await expect(count(page)).toHaveText("0 annotations");
});

test("dragging a corner past the opposite one flips the box, in image px", async ({
  page,
}) => {
  const a = await onPage(page, A);
  const b = await onPage(page, B);
  await drag(page, a, b);
  const scale = (a.x - b.x) / (A.x - B.x);
  // The box runs from B's x and A's y (top-left) to A's x and B's y (bottom-right).
  await drag(page, { x: b.x, y: a.y }, { x: a.x + 100, y: b.y + 60 });
  const near = async (name: "x" | "y" | "w" | "h", value: number) =>
    expect(
      Math.abs((await field(page, name)) - value),
      name,
    ).toBeLessThanOrEqual(8);
  await near("x", A.x);
  await near("y", B.y);
  await near("w", 100 / scale);
  await near("h", 60 / scale);
});

test("an arrow dragged from B to A is recorded by its ends in image px", async ({
  page,
}) => {
  await page.getByRole("radio", { name: "Arrow" }).click();
  const a = await onPage(page, A);
  const b = await onPage(page, B);
  await drag(page, b, a);
  await expect(page.getByRole("heading", { name: "Arrow" })).toBeVisible();
  const end = async (name: "from" | "to") =>
    (await page.getByTestId(`fact-${name}`).textContent())!
      .split(",")
      .map(Number);
  const [x1, y1] = await end("from");
  const [x2, y2] = await end("to");
  for (const [got, want] of [
    [x1, B.x],
    [y1, B.y],
    [x2, A.x],
    [y2, A.y],
  ])
    expect(Math.abs(got - want)).toBeLessThanOrEqual(8);
});

test("undo and redo step by operation: a drag is one entry, a slider drag is one", async ({
  page,
}) => {
  const undoButton = page.getByRole("button", { name: "Undo" });
  await expect(undoButton).toBeDisabled();
  const a = await onPage(page, A);
  const b = await onPage(page, B);
  await drag(page, a, b);
  await page.getByRole("radio", { name: "Select" }).click();
  const x = await field(page, "x");
  const from = onFrame(a, b);
  await drag(page, from, { x: from.x + 100, y: from.y });
  await expect.poll(() => field(page, "x")).toBeGreaterThan(x);

  const stroke = page.getByRole("slider", { name: "Stroke" });
  const before = await stroke.getAttribute("aria-valuenow");
  const thumb = (await stroke.boundingBox())!;
  await drag(
    page,
    { x: thumb.x + thumb.width / 2, y: thumb.y + thumb.height / 2 },
    { x: thumb.x + 80, y: thumb.y + thumb.height / 2 },
  );
  await expect(stroke).not.toHaveAttribute("aria-valuenow", before!);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(stroke).toHaveAttribute("aria-valuenow", before!);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => field(page, "x")).toBe(x);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(count(page)).toHaveText("0 annotations");
  await expect(undoButton).toBeDisabled();

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(count(page)).toHaveText("1 annotation");
  await expect.poll(() => field(page, "x")).toBeGreaterThan(x);
});
