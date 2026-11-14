/**
 * Copy and its fallback (ARCHITECTURE.md §6.5). The clipboard needs a secure page and
 * `ClipboardItem`; without them Copy becomes Download and says why, so it never silently does
 * nothing.
 */

export type ClipboardSupport = "ok" | "insecure" | "unsupported";

export const clipboardSupport = (): ClipboardSupport => {
  if (!window.isSecureContext) return "insecure";
  return typeof ClipboardItem === "undefined" || !navigator.clipboard?.write
    ? "unsupported"
    : "ok";
};

/**
 * Called synchronously from the click with the PNG still rendering: Safari's permission to write
 * doesn't outlive an await, so `ClipboardItem` gets the promise, never the finished blob.
 */
export const copyPng = (png: Promise<Blob>) =>
  navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);

export const downloadBlob = async (blob: Promise<Blob>, name: string) => {
  const url = URL.createObjectURL(await blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
