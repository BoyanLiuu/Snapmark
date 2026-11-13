import { describe, expect, it } from "vitest";
import { sniffFormat } from "./image";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );

describe("sniffFormat", () => {
  // The bytes decide what opens, so the names a file can lie with don't matter.
  it.each([
    ["png", bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])],
    ["jpeg", bytes([0xff, 0xd8, 0xff, 0xe0])],
    ["webp", bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ")],
    ["heic", bytes([0, 0, 0, 0x24], "ftypheic")],
    ["heic", bytes([0, 0, 0, 0x18], "ftypmif1")],
    ["avif", bytes([0, 0, 0, 0x1c], "ftypavif")],
    ["gif", bytes("GIF89a")],
    ["tiff", bytes("II", [0x2a, 0])],
    ["tiff", bytes("MM", [0, 0x2a])],
    ["svg", bytes("  <svg xmlns")],
    [null, bytes("%PDF-1.7")],
    [null, bytes()],
  ])("%s", (format, head) => {
    expect(sniffFormat(head)).toBe(format);
  });
});
