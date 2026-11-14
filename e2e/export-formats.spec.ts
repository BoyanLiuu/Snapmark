import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { count, drawBox, fact, openChart } from "./helpers";

/** M16: the formats, the 64 MP budget, and the states that stand in for a preview. */

const toExport = async (page: Page) => {
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Export /);
};

/** Drops a file built in the page on `selector`, as the open page and the editor take one. */
const dropFile = (page: Page, selector: string, make: string, args: unknown) =>
  page
    .evaluateHandle(
      async ([source, input]) => {
        const file = (await new Function("input", source)(input)) as File;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        return transfer;
      },
      [make, args] as const,
    )
    .then(async (transfer) => {
      await page.dispatchEvent(selector, "drop", { dataTransfer: transfer });
    });

test("JSON names the image by its hash; dropped back on the editor, the annotations land as they were", async ({
  page,
}) => {
  await openChart(page);
  await drawBox(page);
  const [x, y] = [await fact(page, "x"), await fact(page, "y")];
  await toExport(page);
  await page.getByRole("radio", { name: /Annotations as JSON/ }).click();
  await expect(page.getByTestId("export-json")).toContainText(
    '"source": "sha256:',
  );
  await expect(page.getByTestId("export-json")).toContainText("xywh=pixel:");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const json = readFileSync(await (await download).path(), "utf8");

  // Back at the image, the box is still selected.
  await page.getByRole("button", { name: "Back to the image" }).click();
  await expect(page.getByRole("heading", { name: "Rectangle" })).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(count(page)).toHaveText("0 annotations");
  await dropFile(
    page,
    "main",
    "return new File([input], 'test-chart-annotated.json', { type: 'application/json' })",
    json,
  );
  await expect(count(page)).toHaveText("1 annotation");
  await page
    .getByRole("region", { name: "Layers" })
    .getByRole("button", { name: /^Red rectangle/ })
    .click();
  expect([await fact(page, "x"), await fact(page, "y")]).toEqual([x, y]);
});

test("over the 64 MP budget the export says so, and the PNG is drawn smaller rather than blank", async ({
  page,
}) => {
  await page.goto("/");
  // 12000 × 6000, 72 MP, grey with a red bottom-right corner: small as a file, over the budget.
  await dropFile(
    page,
    "main",
    `const canvas = new OffscreenCanvas(input.w, input.h);
     const ctx = canvas.getContext("2d");
     ctx.fillStyle = "#808080";
     ctx.fillRect(0, 0, input.w, input.h);
     ctx.fillStyle = "#ff0000";
     ctx.fillRect(input.w - 400, input.h - 400, 400, 400);
     return canvas.convertToBlob({ type: "image/png" }).then((blob) => new File([blob], "big.png", { type: "image/png" }));`,
    { w: 12000, h: 6000 },
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "big.png" }),
  ).toBeVisible();
  await toExport(page);
  await expect(page.getByTestId("over-budget")).toContainText(
    /This image is 72\.0\sMP, over the 64\sMP budget\. It exports at 11313\s×\s5656 \(94\.3%\)/,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const bytes = readFileSync(await (await download).path());
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([
    11313, 5656,
  ]);
  // Scaled, not cropped: the red corner is still the PNG's corner.
  const corner = await page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([data], { type: "image/png" }),
    );
    const ctx = new OffscreenCanvas(1, 1).getContext("2d")!;
    ctx.drawImage(
      bitmap,
      bitmap.width - 10,
      bitmap.height - 10,
      1,
      1,
      0,
      0,
      1,
      1,
    );
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, bytes.toString("base64"));
  expect(corner).toEqual([255, 0, 0]);
});

test("JPEG downloads only, and the export's states come from the address", async ({
  page,
}) => {
  await openChart(page);
  await toExport(page);
  await page.getByRole("radio", { name: /JPEG/ }).click();
  await expect(page.getByRole("button", { name: "Copy PNG" })).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JPEG" }).click();
  const bytes = readFileSync(await (await download).path());
  expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);

  const address = page.url().split("?")[0];
  const open = async (query: string) => {
    await page.goto(`${address}?${query}`);
    await page.reload();
  };
  await open("state=loading");
  await expect(
    page.getByText(/^Waiting for fonts, then drawing 3840\s×\s2407$/),
  ).toBeVisible();
  await open("state=empty");
  await expect(
    page.getByRole("heading", { name: "Nothing drawn on this image yet" }),
  ).toBeVisible();
  await open("state=error");
  await expect(
    page.getByRole("heading", { name: "This image can’t be exported here" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PNG" }),
  ).toBeDisabled();
});
