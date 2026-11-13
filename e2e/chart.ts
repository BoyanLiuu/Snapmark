/**
 * The test chart (e2e/files/test-chart.png, drawn by scripts/make-fixtures.mjs): 3840 × 2407 with
 * landmarks at known pixels. Each is a solid square of a colour used nowhere else on the chart, so
 * the browser checks find it in the painted pixels instead of trusting a formula.
 */

export const CHART_SIZE = { w: 3840, h: 2407 } as const;

/** Square side, in image px: big enough to stay a solid block at the smallest fit. */
export const LANDMARK_SIDE = 48;

export const LANDMARKS = [
  { name: "A", x: 2964, y: 939, colour: [255, 0, 255] },
  { name: "B", x: 640, y: 1800, colour: [0, 255, 255] },
] as const;
