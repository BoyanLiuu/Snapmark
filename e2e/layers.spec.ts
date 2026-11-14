import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { count, drag, fact, openChart, pixelAt } from "./helpers";

/** M15: the selection is a set, the paint order is the layer list's, and hidden means hidden. */

/** The stage's centre on the page: open grid on the test chart, away from both landmarks. */
const centre = async (page: Page) => {
  const box = (await page
    .locator('canvas[data-layer="overlay"]')
    .boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const box = (page: Page, x: number, y: number, w: number, h: number) =>
  drag(page, { x, y }, { x: x + w, y: y + h });

const isRed = ([r, g, b]: number[]) => r > 180 && g < 110 && b < 110;

test("a marquee selects three; they move as one, and one ⌘Z puts all three back", async ({
  page,
}) => {
  await openChart(page);
  const c = await centre(page);
  await page.getByRole("radio", { name: "Rectangle" }).click();
  for (const dx of [-200, -50, 100]) await box(page, c.x + dx, c.y, 50, 40);
  await page.getByRole("radio", { name: "Select" }).click();
  await drag(
    page,
    { x: c.x - 260, y: c.y - 60 },
    { x: c.x + 210, y: c.y + 100 },
  );
  await expect(
    page.getByRole("heading", { name: "3 annotations" }),
  ).toBeVisible();
  const x = await fact(page, "x");

  // By the middle box's left edge, a member of the selection.
  await drag(page, { x: c.x - 50, y: c.y + 20 }, { x: c.x + 50, y: c.y + 20 });
  await expect.poll(() => fact(page, "x")).toBeGreaterThan(x);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => fact(page, "x")).toBe(x);
  await expect(count(page)).toHaveText("3 annotations");
});

test("dragging a layer row changes what sits on top on the canvas, and ⌥↓ steps it back", async ({
  page,
}) => {
  await openChart(page);
  const c = await centre(page);
  // Two thick frames that cross: red first, then sky over it.
  await page.getByRole("slider", { name: "Stroke" }).press("End");
  await page.getByRole("radio", { name: "Rectangle" }).click();
  await box(page, c.x - 100, c.y - 80, 100, 80);
  await page.keyboard.press("Escape");
  await page.getByRole("radio", { name: "Sky" }).click();
  await box(page, c.x - 50, c.y - 40, 100, 80);
  const crossing = { x: c.x, y: c.y - 40 };
  await expect
    .poll(async () => isRed(await pixelAt(page, crossing)))
    .toBe(false);

  const rows = page.getByRole("complementary").getByRole("listitem");
  await rows.nth(1).dragTo(rows.nth(0));
  await expect
    .poll(async () => isRed(await pixelAt(page, crossing)))
    .toBe(true);

  // The red frame is selected and on top; one step down puts the sky one back over it.
  await rows.nth(0).getByRole("button").first().click();
  await page.keyboard.press("Alt+ArrowDown");
  await expect
    .poll(async () => isRed(await pixelAt(page, crossing)))
    .toBe(false);
});

test("an annotation hidden in the layers is left out of the PNG", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openChart(page);
  const c = await centre(page);
  await page.getByRole("slider", { name: "Stroke" }).press("End");
  await page.getByRole("radio", { name: "Rectangle" }).click();
  await box(page, c.x - 100, c.y - 80, 200, 160);
  const edge = { x: await fact(page, "x"), y: (await fact(page, "y")) + 100 };
  await page.getByRole("button", { name: "Hide Red rectangle" }).click();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByTestId("status-strip").getByRole("status")).toHaveText(
    /^Copied/,
  );
  const copied = await page.evaluate(async ({ x, y }) => {
    const [item] = await navigator.clipboard.read();
    const bitmap = await createImageBitmap(await item.getType("image/png"));
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
      "2d",
    )!;
    ctx.drawImage(bitmap, 0, 0);
    return [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
  }, edge);
  expect(isRed(copied)).toBe(false);
});
