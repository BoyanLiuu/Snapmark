import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { drawBox, fact, openChart } from "./helpers";

/**
 * M8: the PNG, on the clipboard or downloaded, at the image's own size whatever the screen, with
 * the annotations where they were drawn. Run at 2x, a size from the view would be 7680 × 4814.
 */

const status = (page: Page) =>
  page.getByTestId("status-strip").getByRole("status");

/** Width and height from a PNG's header. */
const pngSize = (bytes: Buffer) => [
  bytes.readUInt32BE(16),
  bytes.readUInt32BE(20),
];

test("Copy puts the PNG on the clipboard at the image's own size, the box where it was drawn", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openChart(page);
  await drawBox(page);
  const [x, y, h] = [
    await fact(page, "x"),
    await fact(page, "y"),
    await fact(page, "h"),
  ];
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(status(page)).toHaveText(
    /^Copied the 3840\s×\s2407 PNG\. Nothing was sent anywhere\.$/,
  );

  const copied = await page.evaluate(
    async ([x, y, h]) => {
      const [item] = await navigator.clipboard.read();
      const bitmap = await createImageBitmap(await item.getType("image/png"));
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
        "2d",
      )!;
      ctx.drawImage(bitmap, 0, 0);
      // The box's left edge, half-way down: its 10 px stroke, and not 12 px either side of it.
      const red = (at: number) => {
        const [r, g, b] = ctx.getImageData(at, y + h / 2, 1, 1).data;
        return r > 180 && g < 110 && b < 110;
      };
      return {
        size: [bitmap.width, bitmap.height],
        edge: [red(x - 12), red(x), red(x + 12)],
      };
    },
    [x, y, h],
  );
  expect(copied).toEqual({ size: [3840, 2407], edge: [false, true, false] });
});

test("without a clipboard, Copy downloads the PNG and says why", async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (window as { ClipboardItem?: unknown }).ClipboardItem;
  });
  await openChart(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("test-chart-annotated.png");
  expect(pngSize(readFileSync(await file.path()))).toEqual([3840, 2407]);
  await expect(status(page)).toHaveText(
    "This browser can’t put an image on the clipboard, so this page downloads the PNG instead.",
  );
});

test("a blocked clipboard says so, and Copy becomes Download PNG", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.clipboard.write = () =>
      Promise.reject(new DOMException("Blocked", "NotAllowedError"));
  });
  await openChart(page);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(status(page)).toHaveText(
    "The browser blocked the clipboard for this page. Allow it in the site settings, or download the PNG.",
  );
  await expect(
    page.getByRole("button", { name: "Download PNG" }),
  ).toBeVisible();
});

test("the export page previews the PNG itself, at the image's own size, and downloads it", async ({
  page,
}) => {
  await openChart(page);
  await page.getByRole("button", { name: "Export" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Export test-chart.png" }),
  ).toBeVisible();
  await expect(page.getByText("9.2 MP")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByTestId("export-preview")
        .evaluate((img: HTMLImageElement) => [
          img.naturalWidth,
          img.naturalHeight,
        ]),
    )
    .toEqual([3840, 2407]);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  expect(pngSize(readFileSync(await (await download).path()))).toEqual([
    3840, 2407,
  ]);
  await page.getByRole("button", { name: "Back to the image" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "test-chart.png" }),
  ).toBeVisible();
});
