import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { count, drawBox, openChart } from "./helpers";

/** M9: images and their annotations kept in this browser, filed under the hash of their bytes. */

/** What IndexedDB holds: how many images, and each document's annotation count. */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ images: number; docs: number[] }>((resolve, reject) => {
        const open = indexedDB.open("snapmark");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["images", "docs"]);
          const images = tx.objectStore("images").count();
          const docs = tx.objectStore("docs").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve({
              images: images.result,
              docs: docs.result.map((d) => d.annotations.length),
            });
          };
        };
      }),
  );

const toImages = (page: Page) =>
  page.getByRole("link", { name: "Images" }).click();

test("an image is kept: a reload brings it back with its annotations, and the list shows it", async ({
  page,
}) => {
  await openChart(page);
  await drawBox(page);
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [1] });
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "test-chart.png" }),
  ).toBeVisible();
  await expect(count(page)).toHaveText("1 annotation");
  await toImages(page);
  await expect(
    page.getByRole("listitem").filter({ hasText: "test-chart.png" }),
  ).toContainText("1 annotation");
});

test("the same bytes under another name open the same record", async ({
  page,
}) => {
  await openChart(page, "first.png");
  await drawBox(page);
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [1] });
  const address = page.url();
  await openChart(page, "second.png");
  await expect(count(page)).toHaveText("1 annotation");
  expect(page.url()).toBe(address);
});

test("with storage blocked, an image still opens and the list says why it's empty", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get: () => {
        throw new DOMException("No storage here", "SecurityError");
      },
    }),
  );
  await openChart(page);
  // Not screen 11: nothing is stored, so there is nothing that failed to read.
  await expect(page.getByTestId("nothing-drawn")).toBeVisible();
  await toImages(page);
  await expect(
    page.getByRole("heading", { name: "The list didn’t load" }),
  ).toBeVisible();
});

test("an address for an image this browser doesn't have says so", async ({
  page,
}) => {
  await page.goto("/#/annotate/000000000000");
  await expect(
    page.getByRole("heading", { name: "This image isn’t in this browser" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open an image" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /Annotate to the pixel/ }),
  ).toBeVisible();
});

test("Forget asks first, then removes the image and its annotations", async ({
  page,
}) => {
  await openChart(page);
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [0] });
  await toImages(page);
  const forget = page.getByRole("button", { name: "Forget test-chart.png" });
  await forget.click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(forget).toBeVisible();
  await forget.click();
  await page.getByRole("button", { name: "Forget image" }).click();
  await expect(
    page.getByRole("heading", { name: "No images here yet" }),
  ).toBeVisible();
  expect(await stored(page)).toEqual({ images: 0, docs: [] });
});

test("unreadable annotations: the picture still opens, and Start without them leaves a working editor", async ({
  page,
}) => {
  await openChart(page);
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [0] });
  // A record from some other version of the app.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("snapmark");
        open.onsuccess = () => {
          const store = open.result
            .transaction("docs", "readwrite")
            .objectStore("docs");
          const all = store.getAll();
          all.onsuccess = () => {
            store.put({ hash: all.result[0].hash, schemaVersion: 99 });
            store.transaction.oncomplete = () => resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Couldn’t read this image’s annotations",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("The layers will list here once the annotations load."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start without them" }).click();
  await drawBox(page);
  await expect(count(page)).toHaveText("1 annotation");
});
