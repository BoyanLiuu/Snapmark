import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { CHART_SIZE } from "./chart";
import { count, drag, fact, openChart, stored } from "./helpers";

/** M13: labels written and edited in place, on the canvas's own wrap, font and size. */

const editor = (page: Page) => page.getByTestId("text-editor");
/** The layer row, not its eye button ("Hide …"). */
const layer = (page: Page, name: string) =>
  page
    .getByRole("complementary")
    .getByRole("button", { name: new RegExp(`^${name}`) });

/** Writes a label with its top-left 200, 150 CSS px into the stage; returns where it sits. */
const write = async (page: Page, text: string) => {
  const box = (await page
    .locator('canvas[data-layer="overlay"]')
    .boundingBox())!;
  await page.getByRole("radio", { name: "Text" }).click();
  await page.mouse.click(box.x + 200, box.y + 150);
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type(text);
  // A press on the canvas commits the label, and does nothing else.
  await page.mouse.click(box.x + 700, box.y + 520);
  await expect(editor(page)).toHaveCount(0);
  return { x: box.x + 215, y: box.y + 160 };
};

test("the text tool writes a label; double-click edits it in place, and Esc leaves it as it was", async ({
  page,
}) => {
  await openChart(page);
  const at = await write(page, "Taxi waiting in the red lane");
  await expect(count(page)).toHaveText("1 annotation");
  await expect(layer(page, "Taxi waiting in the red lane")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Select" })).toBeChecked();

  await page.mouse.dblclick(at.x, at.y);
  await expect(editor(page)).toHaveValue("Taxi waiting in the red lane");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Taxi in the bus lane");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(layer(page, "Taxi in the bus lane")).toBeVisible();

  // Open, the label is in the address, so a reload brings the editor back.
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [1] });
  await page.mouse.dblclick(at.x, at.y);
  await expect(page).toHaveURL(/[?&]edit=[0-9a-f]{8}/);
  await page.reload();
  await expect(editor(page)).toHaveValue("Taxi in the bus lane");
  await page.keyboard.type(" and more");
  await page.keyboard.press("Escape");
  await expect(editor(page)).toHaveCount(0);
  await expect(layer(page, "Taxi in the bus lane")).toBeVisible();
});

test("a label's right-hand handle sets the width it wraps at", async ({
  page,
}) => {
  await openChart(page);
  await write(
    page,
    "A label long enough to wrap onto more lines once narrowed",
  );
  const lines = await fact(page, "h");
  // At the fitted zoom, with the defaults for a 3840 px image: 845 px wide, 50 px type.
  const box = (await page
    .locator('canvas[data-layer="overlay"]')
    .boundingBox())!;
  const scale =
    Math.min(box.width / CHART_SIZE.w, box.height / CHART_SIZE.h) * 0.95;
  const pad = 50 * 0.35;
  const handle = {
    x: box.x + 200 + 845 * scale,
    y: box.y + 150 + (lines / 2 - pad) * scale,
  };
  await drag(page, handle, { x: handle.x - 100, y: handle.y });
  await expect.poll(() => fact(page, "h")).toBeGreaterThan(lines);
});
