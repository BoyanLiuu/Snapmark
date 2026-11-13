/**
 * The device-pixel rule (ARCHITECTURE.md §4, IMPLEMENTATION_PLAN.md M2): the pixel ratio and the
 * canvas transform belong to `src/render/view.ts` alone. Folding the ratio into anything else is the
 * bug that only reproduces on a Retina laptop, so it is checked on every test run, not by memory.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const VIEW = "src/render/view.ts";
const MATRIX = "src/geom/matrix.ts";

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const hits = (needle: string) =>
  sourceFiles(join(root, "src")).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) =>
        line.includes(needle) ? [`${relative(root, file)}:${i + 1}`] : [],
      ),
  );

describe("device pixels stay in the view", () => {
  it("sets a canvas transform in exactly one place, in the view", () => {
    const found = hits("setTransform");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(new RegExp(`^${VIEW}:`));
  });

  it("builds matrices only in geom/matrix.ts (M) and the view (the device matrix)", () => {
    const found = hits("DOMMatrix");
    expect(found.length).toBeGreaterThan(0);
    expect(
      found.filter(
        (hit) => !hit.startsWith(`${VIEW}:`) && !hit.startsWith(`${MATRIX}:`),
      ),
    ).toEqual([]);
  });

  it("reads devicePixelRatio only in the view", () => {
    const found = hits("devicePixelRatio");
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((hit) => !hit.startsWith(`${VIEW}:`))).toEqual([]);
  });
});
