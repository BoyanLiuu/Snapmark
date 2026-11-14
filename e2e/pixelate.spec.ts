import type { Page } from "@playwright/test";
import { LANDMARKS } from "./chart";
import { expect, test } from "./fixtures";
import { count, drag, fact, onPage, openChart, stored } from "./helpers";

/**
 * M14: redaction kept live. In the PNG a region is blocks of the original, one colour each, and it
 * is drawn before the opaque marks, so an arrow across it stays sharp.
 */

const [A] = LANDMARKS;

/** A region around landmark A and its label, drawn with the pixelate tool. */
const pixelate = async (page: Page) => {
  const a = await onPage(page, A);
  await page.getByRole("radio", { name: "Pixelate" }).click();
  await drag(page, { x: a.x - 40, y: a.y - 30 }, { x: a.x + 120, y: a.y + 30 });
};

test("in the PNG a region is blocks of the original, and an arrow under it in paint order stays sharp", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openChart(page);
  // A thick arrow first, through where the region will be, from outside it to outside it.
  const a = await onPage(page, A);
  const centre = { x: a.x + 40, y: a.y };
  await page.getByRole("slider", { name: "Stroke" }).press("End");
  await page.getByRole("radio", { name: "Arrow" }).click();
  await drag(
    page,
    { x: centre.x - 120, y: centre.y + 50 },
    { x: centre.x + 120, y: centre.y - 50 },
  );
  await expect(count(page)).toHaveText("1 annotation");
  // Then the region on top of it: pixelate reads the image, not the canvas, before any mark.
  await pixelate(page);
  await expect(count(page)).toHaveText("2 annotations");
  const region = {
    x: await fact(page, "x"),
    y: await fact(page, "y"),
    w: await fact(page, "w"),
    h: await fact(page, "h"),
    block: Number(
      await page
        .getByRole("slider", { name: "Block" })
        .getAttribute("aria-valuenow"),
    ),
  };
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByTestId("status-strip").getByRole("status")).toHaveText(
    /^Copied/,
  );

  const png = await page.evaluate(async ({ x, y, w, h, block }) => {
    const [item] = await navigator.clipboard.read();
    const bitmap = await createImageBitmap(await item.getType("image/png"));
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
      "2d",
    )!;
    ctx.drawImage(bitmap, 0, 0);
    const cols = Math.max(1, Math.round(w / block));
    const rows = Math.max(1, Math.round(h / block));
    /** Whether one block's inside, a pixel in from its edges, is a single colour. */
    const flat = (col: number, row: number) => {
      const x0 = Math.ceil(x + (col * w) / cols) + 1;
      const y0 = Math.ceil(y + (row * h) / rows) + 1;
      const x1 = Math.floor(x + ((col + 1) * w) / cols) - 2;
      const y1 = Math.floor(y + ((row + 1) * h) / rows) - 2;
      const data = ctx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data;
      return data.every((v, i) => v === data[i % 4]);
    };
    const [r, g, b] = ctx.getImageData(x + w / 2, y + h / 2, 1, 1).data;
    return {
      corners: [flat(0, 0), flat(cols - 1, rows - 1)],
      arrow: r > 180 && g < 110 && b < 110,
    };
  }, region);
  expect(png).toEqual({ corners: [true, true], arrow: true });
});

test("a region is still a region after a reload: selectable, its block size editable", async ({
  page,
}) => {
  await openChart(page);
  await pixelate(page);
  await expect(count(page)).toHaveText("1 annotation");
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [1] });
  // The address kept the selection; the reload brings back the region, selected.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pixelate" })).toBeVisible();
  const block = page.getByRole("slider", { name: "Block" });
  await block.press("End");
  await expect(block).toHaveAttribute("aria-valuenow", "120");
});
