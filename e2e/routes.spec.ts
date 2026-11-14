import { expect, test } from "./fixtures";
import { drawBox, fact, openChart, stored } from "./helpers";

/** M10: every screen has an address. Unknown ones are dead ends; the state rides in the query. */

test("an unknown address is screen 33; an image address that isn't a key is screen 32", async ({
  page,
}) => {
  await page.goto("/#/somewhere-else");
  await expect(
    page.getByRole("heading", { name: "There’s no page at this address" }),
  ).toBeVisible();
  await page.goto("/#/annotate/not-a-key");
  await expect(
    page.getByRole("heading", { name: "This image isn’t in this browser" }),
  ).toBeVisible();
  await expect(page.getByText("not-a-key")).toBeVisible();
});

test("the tool and the selection live in the address: a new tab opens on the same state", async ({
  page,
  context,
}) => {
  await openChart(page);
  await drawBox(page);
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [1] });
  await expect(page).toHaveURL(/[?&]tool=rect(&|$)/);
  await expect(page).toHaveURL(/[?&]select=[0-9a-f]{8}(&|$)/);
  const x = await fact(page, "x");

  const copy = await context.newPage();
  await copy.goto(page.url());
  await expect(copy.getByRole("heading", { name: "Rectangle" })).toBeVisible();
  expect(await fact(copy, "x")).toBe(x);
  await expect(copy.getByRole("radio", { name: "Rectangle" })).toBeChecked();
});

test("state parameters reproduce the open page's screens", async ({ page }) => {
  await page.goto("/#/?state=loading");
  await expect(page.getByTestId("library-loading")).toBeVisible();
  await page.goto("/#/?state=error");
  await expect(
    page.getByRole("heading", { name: "The list didn’t load" }),
  ).toBeVisible();
  await page.goto("/#/?drop=heic");
  await expect(page.getByTestId("open-help")).toHaveText(
    /^IMG_4021\.HEIC is a HEIC image\./,
  );
});

test("state parameters reproduce the editor's screens", async ({ page }) => {
  await openChart(page);
  await expect.poll(() => stored(page)).toEqual({ images: 1, docs: [0] });
  const address = page.url();
  const status = page.getByTestId("status-strip").getByRole("status");
  const open = async (query: string) => {
    await page.goto(`${address}?${query}`);
    await page.reload();
  };

  await open("state=loading");
  await expect(page.getByTestId("decoding")).toBeVisible();
  await open("state=error");
  await expect(
    page.getByRole("heading", {
      name: "Couldn’t read this image’s annotations",
    }),
  ).toBeVisible();
  await open("clipboard=none");
  await expect(
    page.getByRole("button", { name: "Download PNG" }),
  ).toBeVisible();
  await expect(status).toHaveText(
    "Copy needs a secure page (https or localhost), so this page downloads the PNG instead.",
  );
  await open("clipboard=denied");
  await expect(status).toHaveText(
    "The browser blocked the clipboard for this page. Allow it in the site settings, or download the PNG.",
  );
});
