import { LANDMARKS } from "./chart";
import { expect, test } from "./fixtures";
import { count, drag, onPage, openChart, pixelAt } from "./helpers";

/** M12: a highlight multiplies, in its own pass before the opaque marks, so it never darkens them. */

const [A, B] = LANDMARKS;

test("a highlight multiplies the image under it and leaves an arrow over it untouched", async ({
  page,
}) => {
  await openChart(page);
  // A thick arrow, so the pixel read on its shaft is all arrow at 1x too.
  await page.getByRole("slider", { name: "Stroke" }).press("End");
  await page.getByRole("radio", { name: "Arrow" }).click();
  const a = await onPage(page, A);
  const b = await onPage(page, B);
  await drag(page, b, a);
  const shaft = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // Inside the highlight about to be drawn, well off the shaft.
  const ground = { x: shaft.x + 30, y: shaft.y + 40 };
  const [shaftBefore, groundBefore] = [
    await pixelAt(page, shaft),
    await pixelAt(page, ground),
  ];

  await page.getByRole("radio", { name: "Highlight" }).click();
  await drag(
    page,
    { x: shaft.x - 60, y: shaft.y - 25 },
    { x: shaft.x + 60, y: shaft.y + 50 },
  );
  await expect(count(page)).toHaveText("2 annotations");

  expect(await pixelAt(page, shaft)).toEqual(shaftBefore);
  // Multiplied by yellow: red kept, blue taken most of the way down.
  const groundAfter = await pixelAt(page, ground);
  expect(Math.abs(groundAfter[0] - groundBefore[0])).toBeLessThanOrEqual(3);
  expect(groundAfter[2]).toBeLessThan(groundBefore[2] * 0.5);
});
