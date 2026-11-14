import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { LANDMARKS } from "./chart";

const CHART = readFileSync(
  join(import.meta.dirname, "files", "test-chart.png"),
);

/** From the open screen into the editor, on the test chart, chosen like any file. */
export const openChart = async (page: Page, name = "test-chart.png") => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: "image/png", buffer: CHART });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

/** The layer list's count. */
export const count = (page: Page) =>
  page.getByRole("complementary").getByText(/^\d+ annotations?$/);

/** Where the base canvas painted a colour: the centre of its pixels, in device px. */
export const findPainted = (
  page: Page,
  colour: readonly number[],
  tolerance = 2,
) =>
  page.evaluate(
    ([target, tolerance]) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        'canvas[data-layer="base"]',
      )!;
      const { data, width } = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height);
      let sx = 0;
      let sy = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i] - target[0]) <= tolerance &&
          Math.abs(data[i + 1] - target[1]) <= tolerance &&
          Math.abs(data[i + 2] - target[2]) <= tolerance
        ) {
          const n = i / 4;
          sx += (n % width) + 0.5;
          sy += Math.floor(n / width) + 0.5;
          count += 1;
        }
      }
      return count ? { x: sx / count, y: sy / count, count } : null;
    },
    [colour, tolerance] as const,
  );

/** Where a landmark is on the page, in CSS px. */
export const onPage = async (
  page: Page,
  landmark: (typeof LANDMARKS)[number],
) => {
  await expect.poll(() => findPainted(page, landmark.colour)).not.toBeNull();
  const painted = (await findPainted(page, landmark.colour))!;
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const box = (await page
    .locator('canvas[data-layer="overlay"]')
    .boundingBox())!;
  return { x: box.x + painted.x / dpr, y: box.y + painted.y / dpr };
};

export const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
};

/** A rectangle from landmark A to landmark B. */
export const drawBox = async (page: Page) => {
  const [A, B] = LANDMARKS;
  await page.getByRole("radio", { name: "Rectangle" }).click();
  await drag(page, await onPage(page, A), await onPage(page, B));
};

/** A box's X, Y, W or H in the inspector. */
export const fact = async (page: Page, name: string) =>
  Number(await page.getByTestId(`fact-${name}`).textContent());

/** What IndexedDB holds: how many images, and each document's annotation count. */
export const stored = (page: Page) =>
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
