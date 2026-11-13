import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** M4: the annotator's states. The sample is held in flight to see screen 08 for certain. */

const SAMPLE_URL = "**/samples/lago-di-braies.webp";
const status = (page: Page) =>
  page.getByTestId("status-strip").getByRole("status");

/** Holds the sample's download until `release` is called. */
const holdSample = async (page: Page) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(SAMPLE_URL, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
};

test("the image's frame shows while it decodes, then the image", async ({
  page,
}) => {
  const release = await holdSample(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open the sample", exact: true })
    .click();
  await expect(page.getByTestId("decoding")).toHaveText(
    /^Decoding 4554\s×\s3036$/,
  );
  await expect(page.getByTestId("layers-loading")).toBeVisible();
  await expect(status(page)).toHaveText("");
  release();
  await expect(page.getByTestId("decoding")).toHaveCount(0);
  await expect(status(page)).toHaveText(
    "7 annotations, last edited 12 Nov 2026, 09:41 UTC.",
  );
});

test("going back while an image decodes drops it", async ({ page }) => {
  const release = await holdSample(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open the sample", exact: true })
    .click();
  await expect(page.getByTestId("decoding")).toBeVisible();
  await page.getByRole("link", { name: "Snapmark, open an image" }).click();
  const response = page.waitForResponse(SAMPLE_URL);
  release();
  await response;
  // Long enough for the dropped decode to have finished and been ignored.
  await page.waitForTimeout(500);
  await expect(
    page.getByRole("heading", { level: 1, name: /Annotate to the pixel/ }),
  ).toBeVisible();
});

test("an image with nothing drawn says so, and Draw a box picks the rectangle", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles(join(import.meta.dirname, "files", "one-pixel.png"));
  const plate = page.getByTestId("nothing-drawn");
  await expect(plate).toContainText("Nothing drawn on this image yet");
  await expect(status(page)).toHaveText(
    /^Nothing drawn yet\. Opened \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC\.$/,
  );
  await plate.getByRole("button", { name: "Draw a box" }).click();
  await expect(page.getByRole("radio", { name: "Rectangle" })).toBeChecked();
});
