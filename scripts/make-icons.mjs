/**
 * Writes src/app/apple-icon.png (committed; run again only after changing src/app/icon.svg).
 *
 * The tab icon is src/app/icon.svg, drawn by hand on a 16-unit grid. iOS wants a PNG for the home
 * screen, so Chromium renders that same file at 180 px here rather than keeping a second drawing.
 *
 *   pnpm icons
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const APPLE_SIZE = 180;
const app = join(dirname(import.meta.dirname), "src", "app");
const svg = readFileSync(join(app, "icon.svg"), "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: APPLE_SIZE, height: APPLE_SIZE },
});
// The viewBox scales; width and height on the element win over the file's own.
await page.setContent(
  `<body style="margin:0"><img width="${APPLE_SIZE}" height="${APPLE_SIZE}"
     src="data:image/svg+xml,${encodeURIComponent(svg)}"></body>`,
);
const img = page.locator("img");
await img.evaluate((el) => el.decode());
writeFileSync(join(app, "apple-icon.png"), await img.screenshot());
await browser.close();
console.log(`apple-icon.png written at ${APPLE_SIZE} × ${APPLE_SIZE}`);
