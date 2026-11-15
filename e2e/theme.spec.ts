import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Dark or light (src/lib/theme.ts). The theme may move the chrome around the image; it may not
 * move the export, so the sample — every kind of annotation — is copied in both and the bytes
 * compared. The context asks for light throughout, which the app is meant to ignore.
 */

test.use({ colorScheme: "light" });

const toggle = (page: Page) =>
  page.getByRole("button", { name: "Switch between dark and light" });

const themeOf = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

test("light is a choice that holds, not the computer's to make", async ({
  page,
}) => {
  await page.goto("/");
  expect(await themeOf(page)).toBe("dark");

  await toggle(page).click();
  expect(await themeOf(page)).toBe("light");
  await page.reload();
  expect(await themeOf(page)).toBe("light");

  await toggle(page).click();
  await page.reload();
  expect(await themeOf(page)).toBe("dark");
});

test("the theme never reaches the export: one PNG, dark and light", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open the sample", exact: true })
    .click();
  const copy = page.getByRole("button", { name: /^Copy|^Copied$/ });
  await expect(copy).toBeEnabled();

  /** The PNG now on the clipboard, by its SHA-256. Waits for this click's own copy. */
  const copied = async () => {
    await copy.click();
    await expect(copy).toHaveText("Copied");
    const hash = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      const bytes = await (await item.getType("image/png")).arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    });
    // "Copied" lasts two seconds: the next one has to be the next click's.
    await expect(copy).toHaveText("Copy", { timeout: 3000 });
    return hash;
  };

  const dark = await copied();
  await toggle(page).click();
  expect(await themeOf(page)).toBe("light");
  expect(await copied()).toBe(dark);
});
