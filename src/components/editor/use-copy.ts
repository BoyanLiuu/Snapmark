"use client";

import { useRef, useState } from "react";
import {
  clipboardSupport,
  copyPng,
  downloadBlob,
  type ClipboardSupport,
} from "@/export/clipboard";
import { exportName } from "@/export/render";
import { forced, type Route } from "@/lib/route";

export interface Notice {
  text: string;
  error?: boolean;
}

const WHY: Record<Exclude<ClipboardSupport, "ok">, string> = {
  insecure:
    "Copy needs a secure page (https or localhost), so this page downloads the PNG instead.",
  unsupported:
    "This browser can’t put an image on the clipboard, so this page downloads the PNG instead.",
};

const BLOCKED =
  "The browser blocked the clipboard for this page. Allow it in the site settings, or download the PNG.";

/**
 * Copy (screens 21–23): the PNG onto the clipboard, or, where this page can't use one, a download
 * that says why. `png` is called from the click itself, so the render starts inside it.
 */
export const useCopy = (
  png: () => Promise<Blob>,
  { name, size }: { name: string; size: string },
  onNotice: (notice: Notice) => void,
  route: Route,
) => {
  // ?clipboard=none or denied: screens 22 and 23 without the browser that causes them.
  const [clipboard] = useState(() =>
    forced(route, "clipboard", ["none", "denied"]),
  );
  const [support] = useState<ClipboardSupport>(() =>
    clipboard === "none" ? "insecure" : clipboardSupport(),
  );
  const [blocked, setBlocked] = useState(clipboard === "denied");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const downloads = support !== "ok" || blocked;

  const download = () => {
    const file = exportName(name);
    downloadBlob(png(), file).then(
      () =>
        onNotice({
          text: support === "ok" ? `Downloaded ${file}.` : WHY[support],
        }),
      (error: Error) =>
        onNotice({ text: `Nothing was saved: ${error.message}`, error: true }),
    );
  };

  const copy = () => {
    if (downloads) return download();
    copyPng(png()).then(
      () => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
        onNotice({
          text: `Copied the ${size} PNG. Nothing was sent anywhere.`,
        });
      },
      (error: Error) => {
        const refused = error.name === "NotAllowedError";
        if (refused) setBlocked(true);
        onNotice({
          text: refused ? BLOCKED : `Nothing was copied: ${error.message}`,
          error: true,
        });
      },
    );
  };

  let reason: string | null = null;
  if (support !== "ok") reason = WHY[support];
  else if (blocked) reason = BLOCKED;

  return { copied, blocked, reason, downloads, copy, download };
};

export type Copying = ReturnType<typeof useCopy>;
