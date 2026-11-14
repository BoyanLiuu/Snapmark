"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { renderPng } from "@/export/render";
import { go } from "@/lib/route";
import { nbsp, sizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import { withoutIds } from "@/model/doc";
import { AppBar } from "../editor/app-bar";
import { imageOf, type EditorSession } from "../editor/editor-shell";
import { useCopy, type Notice } from "../editor/use-copy";
import { CORNERS } from "../open/corners";
import { SampleCredit } from "../open/sample-credit";

const BUDGET_MP = 64;

const FORMATS = [
  { id: "png", label: "PNG", help: "Copy or download, lossless" },
  { id: "jpeg", label: "JPEG", help: "Download, smaller for photos" },
  {
    id: "json",
    label: "Annotations as JSON",
    help: "W3C Web Annotation, image pixels",
  },
] as const;

/**
 * Screen 25: the PNG as it will be copied or saved, drawn from the document at the image's own
 * size. The preview is that PNG, scaled by the page; JPEG, JSON and the 64 MP budget arrive in M16.
 */
export const ExportPage = ({
  session,
  onHome,
}: {
  session: EditorSession;
  onHome: () => void;
}) => {
  const ready = session.state === "ready" ? session : null;
  const { name, natural } = imageOf(session);
  const [scale, setScale] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // One render, shared by the preview, Copy and Download.
  const png = useMemo(
    () =>
      ready &&
      renderPng(withoutIds(ready.doc, ready.hidden), ready.image.bitmap),
    [ready],
  );

  const preview = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !png || !ready) return;
      let url: string | null = null;
      let live = true;
      png.then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        img.src = url;
      });
      const measure = () => setScale(img.clientWidth / ready.image.natural.w);
      const observer = new ResizeObserver(measure);
      observer.observe(img);
      return () => {
        live = false;
        observer.disconnect();
        if (url) URL.revokeObjectURL(url);
      };
    },
    [png, ready],
  );

  const size = natural ? sizeText(natural) : "–";
  const copying = useCopy(
    () => png ?? Promise.reject(new Error("the image is still opening.")),
    { name, size },
    setNotice,
  );
  const back = () => go(`#/annotate/${session.key}`);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar variant="app" onHome={onHome} />
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 content-start gap-10 px-16 py-10 max-[60rem]:px-6 max-[40rem]:px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <h1 className="min-w-0 truncate text-[2.074rem] leading-[1.1] font-medium tracking-[-0.04em]">
            Export {name}
          </h1>
          <Button variant="outline" size="control" onClick={back}>
            Back to the image
          </Button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_26.75rem] items-start gap-8 max-[60rem]:grid-cols-1">
          <figure className={cn(CORNERS, "m-0 border bg-card")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the export itself, a local blob */}
            <img
              ref={preview}
              alt={`The export of ${name}, ${size} px`}
              data-testid="export-preview"
              style={{
                aspectRatio: natural ? `${natural.w} / ${natural.h}` : "3 / 2",
              }}
              // Holds its box, unseen, until the PNG has been drawn.
              className="block w-full [&:not([src])]:invisible"
            />
            <figcaption className="flex gap-10 border-t px-4 py-2 text-sm">
              <p className="grid">
                <span className="text-xs text-ink-2">Preview</span>
                <span className="font-mono tabular-nums">
                  {scale === null ? "–" : `${Math.round(scale * 100)}%`}
                </span>
              </p>
              <p className="grid">
                <span className="text-xs text-ink-2">Drawn</span>
                <span>
                  from the document at the image’s own size, never from the
                  screen
                </span>
              </p>
            </figcaption>
          </figure>

          <section
            aria-label="Export settings"
            className="grid gap-6 bg-card p-6"
          >
            <div
              role="radiogroup"
              aria-labelledby="format-label"
              className="grid gap-2"
            >
              <span id="format-label" className="text-sm text-ink-2">
                Format
              </span>
              {FORMATS.map(({ id, label, help }) => {
                const on = id === "png";
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!on}
                    title={on ? undefined : `${label} arrives in M16`}
                    className={cn(
                      "grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 border px-4 py-3 text-left disabled:text-muted-foreground",
                      on ? "border-foreground" : "border-rule-2",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2",
                        on ? "bg-primary" : "border border-muted-2",
                      )}
                    />
                    <span className="text-base">{label}</span>
                    <span className="col-start-2 text-sm text-ink-2">
                      {help}
                    </span>
                  </button>
                );
              })}
            </div>

            <dl className="grid grid-cols-3 border-t border-rule-2 pt-3">
              {(
                [
                  ["Output, px", size],
                  [
                    "Pixels",
                    natural
                      ? `${((natural.w * natural.h) / 1e6).toFixed(1)} MP`
                      : "–",
                  ],
                  ["Budget", `${BUDGET_MP} MP`],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 border-r border-rule-2 px-3 first:pl-0 last:border-r-0"
                >
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-mono text-sm whitespace-nowrap tabular-nums">
                    {nbsp(value)}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-3">
              {!copying.downloads && (
                <Button size="control" disabled={!png} onClick={copying.copy}>
                  {copying.copied ? "Copied" : "Copy PNG"}
                </Button>
              )}
              <Button
                variant={copying.downloads ? "default" : "outline"}
                size="control"
                disabled={!png}
                onClick={copying.download}
              >
                Download PNG
              </Button>
            </div>
            <p
              role="status"
              className={cn(
                "min-h-lh text-sm text-ink-2",
                notice?.error && "text-destructive",
              )}
            >
              {notice?.text ?? copying.reason}
            </p>
          </section>
        </div>
      </main>
      {session.sample && (
        <footer className="border-t px-16 py-6 max-[60rem]:px-6">
          <SampleCredit className="text-xs text-muted-foreground" />
        </footer>
      )}
    </div>
  );
};
