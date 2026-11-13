import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { SWATCHES } from "../src/model/palette";
import { findPainted } from "./helpers";

/** M3: every way an image gets in, and the one way it is refused. Files: scripts/make-fixtures.mjs. */

const file = (name: string) => join(import.meta.dirname, "files", name);
const choose = (page: Page, name: string) =>
  page.locator('input[type="file"]').setInputFiles(file(name));
const onePixel = readFileSync(file("one-pixel.png")).toString("base64");

/** A DataTransfer carrying a PNG, as a drop or a paste brings it. */
const transferOf = (page: Page, name: string) =>
  page.evaluateHandle(
    ([base64, fileName]) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], fileName, { type: "image/png" }));
      return transfer;
    },
    [onePixel, name] as const,
  );

const opened = (page: Page, name: string) =>
  expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("choosing a file opens it at its natural size", async ({ page }) => {
  await choose(page, "one-pixel.png");
  await opened(page, "one-pixel.png");
  await expect(page.getByText(/^1\s×\s1\spx$/)).toBeVisible();
});

test("an EXIF-rotated photo opens upright", async ({ page }) => {
  // Stored 400 × 200 as red, green over blue, yellow, with Orientation 6 (turn 90° clockwise).
  await choose(page, "rotated.jpg");
  await opened(page, "rotated.jpg");
  await expect(page.getByText(/^200\s×\s400\spx$/)).toBeVisible();
  // Upright, it reads blue, red over yellow, green. JPEG shifts colours a little.
  const where = async (colour: number[]) => {
    await expect.poll(() => findPainted(page, colour, 24)).not.toBeNull();
    return (await findPainted(page, colour, 24))!;
  };
  const blue = await where([0, 0, 255]);
  const red = await where([255, 0, 0]);
  const yellow = await where([255, 255, 0]);
  const green = await where([0, 255, 0]);
  expect(blue.x).toBeLessThan(red.x);
  expect(blue.y).toBeLessThan(yellow.y);
  expect(green.x).toBeGreaterThan(yellow.x);
  expect(green.y).toBeGreaterThan(red.y);
});

test("a HEIC file is refused by name, and the page stays put", async ({
  page,
}) => {
  await choose(page, "photo.heic");
  await expect(page.getByTestId("open-help")).toHaveText(
    "photo.heic is a HEIC image. Snapmark opens PNG, JPEG and WebP: save it as one of those and try again.",
  );
  await expect(
    page.getByRole("button", { name: "Choose an image" }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { level: 1, name: /Annotate to the pixel/ }),
  ).toBeVisible();
});

test("a file dropped anywhere opens, with the whole page in its drop state", async ({
  page,
}) => {
  const transfer = await transferOf(page, "dropped.png");
  await page.dispatchEvent("main", "dragenter", { dataTransfer: transfer });
  await expect(page.getByTestId("drop-veil")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.dispatchEvent("main", "drop", { dataTransfer: transfer });
  await opened(page, "dropped.png");
});

test("a pasted image opens", async ({ page }) => {
  const transfer = await transferOf(page, "image.png");
  await page.evaluate((clipboardData) => {
    document.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, transfer);
  await opened(page, "image.png");
});

test("the sample opens from this app, credited", async ({ page }) => {
  await page
    .getByRole("button", { name: "Open the sample", exact: true })
    .click();
  await opened(page, "Lago-di-Braies.webp");
  await expect(page.getByText(/^4554\s×\s3036\spx$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "CC0" })).toBeVisible();
});

test("the sample's annotations are drawn, and hiding one takes it off the canvas", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Open the sample", exact: true })
    .click();
  await opened(page, "Lago-di-Braies.webp");
  // The orange swatch as the canvas paints it; only the boathouse box uses it.
  const orange = await page.evaluate(
    (css) => {
      const ctx = new OffscreenCanvas(1, 1).getContext("2d")!;
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    },
    SWATCHES.find((s) => s.id === "orange")!.css,
  );
  const painted = async () => (await findPainted(page, orange))?.count ?? 0;
  await expect.poll(painted).toBeGreaterThan(50);
  const shown = await painted();
  await page.getByRole("button", { name: "Hide Orange rectangle" }).click();
  await expect.poll(painted).toBeLessThan(shown * 0.1);
});
