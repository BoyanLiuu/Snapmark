/**
 * The image M2 draws until M3 opens real ones: a 3840 × 2407 test chart (the design file's sample
 * size) with landmarks at known pixels, so the coordinate chain can be checked by eye and by test.
 * It is generated in the browser rather than committed, so there is no binary to keep in step.
 */

import type { Point, Size } from "@/model/types";

export const CHART_NAME = "Test chart";
export const CHART_SIZE: Size = { w: 3840, h: 2407 };

export interface Landmark extends Point {
  name: string;
  /** A colour used nowhere else on the chart, so a test can find the landmark in the pixels. */
  colour: readonly [number, number, number];
}

/** A is the design file's signature point: the box corner it reads at every zoom. */
export const LANDMARKS: readonly Landmark[] = [
  { name: "A", x: 2964, y: 939, colour: [255, 0, 255] },
  { name: "B", x: 640, y: 1800, colour: [0, 255, 255] },
];

/** Landmark squares, in image px: big enough to stay a solid block at the smallest fit. */
export const LANDMARK_SIDE = 48;

const BACKGROUND = "#34312d";
const MINOR = "#423e39";
const MAJOR = "#5c5750";
const LABEL = "#c9c2b8";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const drawChart = (ctx: OffscreenCanvasRenderingContext2D) => {
  const { w, h } = CHART_SIZE;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, w, h);

  // A grid every 80 px, heavier every 400 px, with the major lines labelled in image px.
  for (let step = 80; step < Math.max(w, h); step += 80) {
    const major = step % 400 === 0;
    ctx.fillStyle = major ? MAJOR : MINOR;
    const t = major ? 4 : 2;
    if (step < w) ctx.fillRect(step - t / 2, 0, t, h);
    if (step < h) ctx.fillRect(0, step - t / 2, w, t);
  }
  ctx.fillStyle = LABEL;
  ctx.font = `500 36px ${MONO}`;
  ctx.textBaseline = "top";
  for (let x = 400; x < w; x += 400) ctx.fillText(String(x), x + 12, 16);
  for (let y = 400; y < h; y += 400) ctx.fillText(String(y), 16, y + 12);

  // The image's own edge, so the fit can be judged against the stage.
  ctx.strokeStyle = LABEL;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.font = `500 64px ${MONO}`;
  ctx.textBaseline = "bottom";
  ctx.fillText(`Snapmark test chart · ${w} × ${h}`, 120, h - 96);

  for (const { name, x, y, colour } of LANDMARKS) {
    const rgb = `rgb(${colour.join(" ")})`;
    const half = LANDMARK_SIDE / 2;
    ctx.fillStyle = rgb;
    ctx.fillRect(x - 160, y - 2, 320, 4);
    ctx.fillRect(x - 2, y - 160, 4, 320);
    ctx.fillRect(x - half, y - half, LANDMARK_SIDE, LANDMARK_SIDE);
    // The label in the chart's own colour: only the symmetric mark carries the landmark's.
    ctx.fillStyle = LABEL;
    ctx.font = `600 52px ${MONO}`;
    ctx.textBaseline = "bottom";
    ctx.fillText(`${name} · x ${x} y ${y}`, x + 48, y - 48);
  }
};

export const createTestChart = async (): Promise<ImageBitmap> => {
  const canvas = new OffscreenCanvas(CHART_SIZE.w, CHART_SIZE.h);
  drawChart(canvas.getContext("2d")!);
  return canvas.transferToImageBitmap();
};
