import type { Page } from "@playwright/test";
import { LANDMARKS } from "./chart";
import { expect, test } from "./fixtures";
import { count, onPage, openChart, stored } from "./helpers";

/**
 * M11: zoom and pan move the camera and nothing else. The test that matters: the PNG copied at the
 * fitted zoom and the one copied at 244% are the same bytes.
 */

const [A] = LANDMARKS;
const zoomReadout = (page: Page) => page.getByTestId("zoom-readout");
const percent = async (page: Page) =>
  Number((await zoomReadout(page).textContent())?.match(/^(\d+)%/)?.[1]);

/** The PNG Copy puts on the clipboard, as a SHA-256. */
const copiedPng = async (page: Page) => {
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.getByRole("button", { name: /^Cop(y|ied)$/ }).click();
  return expect
    .poll(() =>
      page.evaluate(async () => {
        const [item] = await navigator.clipboard.read();
        if (!item?.types.includes("image/png")) return null;
        const bytes = await (await item.getType("image/png")).arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest)).join(",");
      }),
    )
    .not.toBeNull()
    .then(() =>
      page.evaluate(async () => {
        const [item] = await navigator.clipboard.read();
        const bytes = await (await item.getType("image/png")).arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest)).join(",");
      }),
    );
};

test("the PNG is the same bytes copied at the fitted zoom and at 244%", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  // The sample has every kind: pixelate and highlight read the view's state if anything does.
  await page
    .getByRole("button", { name: "Open the sample", exact: true })
    .click();
  await expect(count(page)).toHaveText("7 annotations");
  const atFit = await copiedPng(page);

  await page.getByRole("button", { name: "1:1" }).click();
  for (let i = 0; i < 4; i += 1)
    await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(zoomReadout(page)).toHaveText(/^244%/);
  expect(await copiedPng(page)).toBe(atFit);
});

test("the wheel zooms at the pointer, keeping the pixel under it, and the address keeps the view", async ({
  page,
}) => {
  await openChart(page);
  const fitted = await percent(page);
  const a = await onPage(page, A);
  const readout = page.getByTestId("cursor-readout");
  await page.mouse.move(a.x, a.y);
  const before = await readout.textContent();

  for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, -300);
  await expect.poll(() => percent(page)).toBeGreaterThan(fitted * 3);
  // Off and back to the same screen point: the readout is read afresh.
  await page.mouse.move(a.x + 40, a.y);
  await page.mouse.move(a.x, a.y);
  await expect(readout).toHaveText(before!);

  await expect(page).toHaveURL(/[?&]zoom=\d+&at=\d+,\d+/);
  const zoomed = await zoomReadout(page).textContent();
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [0] });
  await page.reload();
  await expect(zoomReadout(page)).toHaveText(zoomed!);

  await page.getByRole("button", { name: "Fit" }).click();
  await expect(zoomReadout(page)).toHaveText(new RegExp(`^${fitted}%`));
  await expect(page).not.toHaveURL(/zoom=/);
});

test("Space-drag and the middle button pan whatever the tool, and draw nothing", async ({
  page,
}) => {
  await openChart(page);
  await page.getByRole("radio", { name: "Rectangle" }).click();
  const start = await onPage(page, A);
  const moved = async (dx: number, dy: number) => {
    await expect
      .poll(async () => {
        const now = await onPage(page, A);
        return Math.max(
          Math.abs(now.x - start.x - dx),
          Math.abs(now.y - start.y - dy),
        );
      })
      .toBeLessThanOrEqual(1.5);
  };

  await page.mouse.move(start.x, start.y);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(start.x - 150, start.y + 60, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await moved(-150, 60);

  await page.mouse.down({ button: "middle" });
  await page.mouse.move(start.x - 150 + 80, start.y + 60 - 40, { steps: 6 });
  await page.mouse.up({ button: "middle" });
  await moved(-70, 20);
  await expect(count(page)).toHaveText("0 annotations");
});
