import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** From the open screen into the editor, on the test chart, chosen like any file. */
export const openChart = async (page: Page) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles(join(import.meta.dirname, "files", "test-chart.png"));
  await expect(
    page.getByRole("heading", { level: 1, name: "test-chart.png" }),
  ).toBeVisible();
};

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
