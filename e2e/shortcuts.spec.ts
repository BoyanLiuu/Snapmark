import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { count, drawBox, fact, openChart } from "./helpers";

/** M18: every key the shortcuts panel lists does what it says. */

const zoom = (page: Page) => page.getByTestId("zoom-readout");

test("the panel opens from the app bar, on the open page and in the editor", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Shortcuts" }).click();
  const panel = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(panel.getByRole("row")).toHaveCount(11);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);

  await openChart(page);
  await page.getByRole("button", { name: "Shortcuts" }).click();
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("every row in the panel does what it says", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openChart(page);
  await expect(zoom(page)).toHaveText(/^\d+%/);
  const fitted = await zoom(page).textContent();

  // V R A H T P
  for (const [key, tool] of [
    ["r", "Rectangle"],
    ["a", "Arrow"],
    ["h", "Highlight"],
    ["t", "Text"],
    ["p", "Pixelate"],
    ["v", "Select"],
  ])
    await page.keyboard
      .press(key)
      .then(() =>
        expect(page.getByRole("radio", { name: tool })).toBeChecked(),
      );

  // A box to work on: nudge it 1 and 10 image px, undo the run in one step.
  await drawBox(page);
  const x = await fact(page, "x");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => fact(page, "x")).toBe(x + 11);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => fact(page, "x")).toBe(x);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => fact(page, "x")).toBe(x + 11);

  await page.keyboard.press("ControlOrMeta+c");
  await expect(page.getByTestId("status-strip").getByRole("status")).toHaveText(
    /^Copied/,
  );

  await page.keyboard.press("Shift+Digit0");
  await expect(zoom(page)).toHaveText(/^100%/);
  await page.keyboard.press("=");
  await expect(zoom(page)).toHaveText(/^125%/);
  await page.keyboard.press("-");
  await expect(zoom(page)).toHaveText(/^100%/);
  await page.keyboard.press("Shift+Digit1");
  await expect(zoom(page)).toHaveText(fitted!);

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "New annotations" }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Layers" })
    .getByRole("button", { name: /^Red rectangle/ })
    .click();
  await page.keyboard.press("Delete");
  await expect(count(page)).toHaveText("0 annotations");
});

test("typing in a label types: R is a letter there, not the rectangle", async ({
  page,
}) => {
  await openChart(page);
  const box = (await page
    .locator('canvas[data-layer="overlay"]')
    .boundingBox())!;
  await page.keyboard.press("t");
  await page.mouse.click(box.x + 200, box.y + 150);
  const editor = page.getByTestId("text-editor");
  await expect(editor).toBeFocused();
  await page.keyboard.type("rav");
  await expect(editor).toHaveValue("rav");
  await expect(page.getByRole("radio", { name: "Text" })).toBeChecked();
});
