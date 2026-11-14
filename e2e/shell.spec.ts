import { expect, test } from "./fixtures";
import { openChart } from "./helpers";

/**
 * M1's checks that outlast the shell. The layout itself was compared with the design file by eye;
 * the sample data and the inert controls are replaced from M3 on, and tested then.
 */

test.beforeEach(async ({ page }) => {
  await openChart(page);
});

test("Copy is the editor bar's one orange button, and Export is not", async ({
  page,
}) => {
  // The plan's rule: Copy is the primary action on every screen. Do not invert it.
  const background = (name: string) =>
    page
      .getByRole("button", { name, exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  const orange = await background("Copy");
  expect(orange).not.toBe("rgba(0, 0, 0, 0)");
  expect(await background("Export")).toBe("rgba(0, 0, 0, 0)");
  // The empty state's "Draw a box" is orange too, as in the design; the rule is the bar's.
  const filled = await page
    .getByTestId("editor-bar")
    .getByRole("button")
    .evaluateAll(
      (buttons, colour) =>
        buttons.filter((b) => getComputedStyle(b).backgroundColor === colour)
          .length,
      orange,
    );
  expect(filled).toBe(1);
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

test("the tab icon is Snapmark's mark, served from this app", async ({
  page,
  request,
}) => {
  const icons = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')].map(
      (link) => link.href,
    ),
  );
  expect(icons).toHaveLength(1);
  const response = await request.get(icons[0]);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  // Drawn at 16 px, it is the mark: the orange centre pixel on dark paper, inside the frame.
  const drawn = await page.evaluate(async (href) => {
    const img = new Image();
    img.src = href;
    await img.decode();
    const ctx = new OffscreenCanvas(16, 16).getContext("2d")!;
    ctx.drawImage(img, 0, 0, 16, 16);
    const at = (x: number, y: number) =>
      [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
    return { centre: at(8, 8), inside: at(8, 6), corner: at(0, 0) };
  }, icons[0]);
  const orange = (rgb: number[]) =>
    rgb[0] > 200 && rgb[1] > 90 && rgb[1] < 160 && rgb[2] < 110;
  const dark = (rgb: number[]) => rgb.every((v) => v < 40);
  expect(orange(drawn.centre)).toBe(true);
  expect(dark(drawn.inside)).toBe(true);
  expect(dark(drawn.corner)).toBe(true);
});
