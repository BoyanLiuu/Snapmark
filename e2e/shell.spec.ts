import { expect, test } from "./fixtures";

/**
 * M1's checks that outlast the shell. The layout itself was compared with the design file by eye;
 * the sample data and the inert controls are replaced from M3 on, and tested then.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("Copy is the one orange button, and Export is not", async ({ page }) => {
  // The plan's rule: Copy is the primary action on every screen. Do not invert it.
  const background = (name: string) =>
    page
      .getByRole("button", { name, exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  const orange = await background("Copy");
  expect(orange).not.toBe("rgba(0, 0, 0, 0)");
  expect(await background("Export")).toBe("rgba(0, 0, 0, 0)");
  const filled = await page
    .getByRole("button")
    .evaluateAll(
      (buttons, colour) =>
        buttons.filter((b) => getComputedStyle(b).backgroundColor === colour)
          .length,
      orange,
    );
  expect(filled).toBe(1);
});

test("the tool and colour groups always keep one choice", async ({ page }) => {
  for (const [group, from, to] of [
    ["Tool", "Select", "Rectangle"],
    ["Colour", "Red", "Sky"],
  ]) {
    const radios = page.getByRole("radiogroup", { name: group });
    await expect(radios.getByRole("radio", { name: from })).toBeChecked();
    const target = radios.getByRole("radio", { name: to });
    await target.click();
    await expect(target).toBeChecked();
    // Choosing the current one again must not leave the group with nothing chosen.
    await target.click();
    await expect(target).toBeChecked();
  }
});

test("the sliders are named, with their units", async ({ page }) => {
  // Radix puts role="slider" on the thumb, so a name on the root alone leaves it unnamed.
  await expect(page.getByRole("slider", { name: "Stroke" })).toHaveAttribute(
    "aria-valuetext",
    /^10\spx$/,
  );
  await expect(page.getByRole("slider", { name: "Opacity" })).toHaveAttribute(
    "aria-valuetext",
    "100%",
  );
});

test("no request leaves the app's own host, and Switzer loads from it", async ({
  page,
  baseURL,
}) => {
  // Switzer's licence and the product's promise: fonts are self-hosted, nothing is fetched elsewhere.
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect([...hosts]).toEqual([new URL(baseURL!).host]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts].some(
          (f) => /switzer/i.test(f.family) && f.status === "loaded",
        ),
      ),
    )
    .toBe(true);
});
