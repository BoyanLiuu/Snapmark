/**
 * Writes the image fixtures in e2e/files/ (committed; run again only to change them).
 *
 *   one-pixel.png    1 × 1, the smallest image there is
 *   rotated.jpg      stored 400 × 200 with quadrants red, green / blue, yellow, and EXIF
 *                    Orientation 6, so it must open as 200 × 400 with blue top-left
 *   photo.heic       the same quadrants as HEIC, which Snapmark refuses by name
 *   test-chart.png   3840 × 2407 with landmarks at known pixels (e2e/chart.ts), for the
 *                    coordinate-chain checks
 *
 * The JPEG and the PNG for HEIC are drawn by Chromium (Playwright); HEIC needs macOS `sips`.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { CHART_SIZE, LANDMARKS, LANDMARK_SIDE } from "../e2e/chart.ts";

const out = new URL("../e2e/files/", import.meta.url).pathname;

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

/** A 1 × 1 opaque PNG: signature, IHDR, one filtered scanline, IEND. */
const onePixelPng = (r, g, b) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.from([0, r, g, b]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/** An Exif APP1 segment holding only Orientation, little-endian TIFF. */
const exifOrientation = (value) => {
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0 offset
  tiff.writeUInt16LE(1, 8); // one entry
  tiff.writeUInt16LE(0x0112, 10); // Orientation
  tiff.writeUInt16LE(3, 12); // SHORT
  tiff.writeUInt32LE(1, 14); // count
  tiff.writeUInt16LE(value, 18);
  tiff.writeUInt32LE(0, 22); // no next IFD
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const quadrants = (type) =>
  page.evaluate(async (mime) => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    for (const [x, y, colour] of [
      [0, 0, "#ff0000"],
      [200, 0, "#00ff00"],
      [0, 100, "#0000ff"],
      [200, 100, "#ffff00"],
    ]) {
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 200, 100);
    }
    return canvas.toDataURL(mime, 0.95).split(",")[1];
  }, type);
/** The test chart: a labelled grid, the image's edge, and the landmarks as solid squares. */
const chart = () =>
  page.evaluate(
    ({ size, landmarks, side }) => {
      const { w, h } = size;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#34312d";
      ctx.fillRect(0, 0, w, h);
      // A grid every 80 px, heavier every 400 px, with the major lines labelled in image px.
      for (let step = 80; step < Math.max(w, h); step += 80) {
        const major = step % 400 === 0;
        ctx.fillStyle = major ? "#5c5750" : "#423e39";
        const t = major ? 4 : 2;
        if (step < w) ctx.fillRect(step - t / 2, 0, t, h);
        if (step < h) ctx.fillRect(0, step - t / 2, w, t);
      }
      ctx.fillStyle = "#c9c2b8";
      ctx.font = `500 36px ${MONO}`;
      ctx.textBaseline = "top";
      for (let x = 400; x < w; x += 400) ctx.fillText(String(x), x + 12, 16);
      for (let y = 400; y < h; y += 400) ctx.fillText(String(y), 16, y + 12);
      ctx.strokeStyle = "#c9c2b8";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      for (const { name, x, y, colour } of landmarks) {
        ctx.fillStyle = `rgb(${colour.join(" ")})`;
        ctx.fillRect(x - 160, y - 2, 320, 4);
        ctx.fillRect(x - 2, y - 160, 4, 320);
        ctx.fillRect(x - side / 2, y - side / 2, side, side);
        // The label in the chart's own colour: only the symmetric mark carries the landmark's.
        ctx.fillStyle = "#c9c2b8";
        ctx.font = `600 52px ${MONO}`;
        ctx.textBaseline = "bottom";
        ctx.fillText(`${name} · x ${x} y ${y}`, x + 48, y - 48);
      }
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { size: CHART_SIZE, landmarks: LANDMARKS, side: LANDMARK_SIDE },
  );
const chartPng = Buffer.from(await chart(), "base64");
const jpeg = Buffer.from(await quadrants("image/jpeg"), "base64");
const png = Buffer.from(await quadrants("image/png"), "base64");
await browser.close();

writeFileSync(join(out, "one-pixel.png"), onePixelPng(232, 89, 12));
writeFileSync(join(out, "test-chart.png"), chartPng);
// The Exif segment goes straight after SOI (FF D8).
writeFileSync(
  join(out, "rotated.jpg"),
  Buffer.concat([jpeg.subarray(0, 2), exifOrientation(6), jpeg.subarray(2)]),
);
const work = mkdtempSync(join(tmpdir(), "snapmark-fixtures-"));
writeFileSync(join(work, "quadrants.png"), png);
execFileSync(
  "sips",
  [
    "-s",
    "format",
    "heic",
    join(work, "quadrants.png"),
    "--out",
    join(out, "photo.heic"),
  ],
  { stdio: "ignore" },
);
console.log("wrote one-pixel.png, rotated.jpg, photo.heic, test-chart.png");
