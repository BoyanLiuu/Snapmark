"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toWebAnnotations } from "@/export/annotations";
import { downloadBlob } from "@/export/clipboard";
import { BUDGET_MP, exportSize, readable } from "@/export/limits";
import { exportName, renderImage } from "@/export/render";
import { forced, go, setQuery, type Route } from "@/lib/route";
import { nbsp, sizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import { withoutIds } from "@/model/doc";
import { AppBar } from "../editor/app-bar";
import { imageOf, type EditorSession } from "../editor/editor-shell";
import { useCopy, type Notice } from "../editor/use-copy";
import { CORNERS } from "../open/corners";
import { SampleCredit } from "../open/sample-credit";

type Format = "png" | "jpeg" | "json";

const FORMATS: { id: Format; label: string; help: string }[] = [
  { id: "png", label: "PNG", help: "Copy or download, lossless" },
  { id: "jpeg", label: "JPEG", help: "Download, smaller for photos" },
  {
    id: "json",
    label: "Annotations as JSON",
    help: "W3C Web Annotation, image pixels",
  },
];

const mp = (w: number, h: number) => `${((w * h) / 1e6).toFixed(1)} MP`;

const Facts = ({ facts }: { facts: [string, string][] }) => (
  <dl className="grid grid-cols-3 border-t border-rule-2 pt-3">
    {facts.map(([label, value]) => (
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
);

/** Screens 30 and 31: what stands in the preview's place when there is nothing, or no way, to draw. */
const Plate = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="grid justify-items-start gap-3 px-10 py-16">
    <h2 className="text-[1.44rem] leading-[1.05] font-medium tracking-[-0.04em]">
      {title}
    </h2>
    {children}
  </div>
);

/**
 * Screens 25–31: the export, drawn from the document at the image's own size (or within the 64 MP
 * budget), as a PNG to copy or save, a JPEG to save, or the annotations as JSON. The preview is the
 * file itself, scaled by the page. `?format=` picks the format; `?state=` shows drawing (29),
 * nothing drawn (30) and an image the browser won't let be read (31).
 */
export const ExportPage = ({
  route,
  session,
  onHome,
}: {
  route: Route;
  session: EditorSession;
  onHome: () => void;
}) => {
  const ready = session.state === "ready" ? session : null;
  const { name, natural } = imageOf(session);
  const [format, setFormat] = useState<Format>(
    () => forced(route, "format", ["png", "jpeg", "json"]) ?? "png",
  );
  const [state] = useState(() =>
    forced(route, "state", ["loading", "empty", "error"]),
  );
  const [quality, setQuality] = useState(90);
  const [shownQuality, setShownQuality] = useState(90);
  const [scale, setScale] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const doc = useMemo(() => {
    if (!ready) return null;
    const visible = withoutIds(ready.doc, ready.hidden);
    return state === "empty"
      ? withoutIds(visible, new Set(visible.order))
      : visible;
  }, [ready, state]);
  const blocked = useMemo(
    () => state === "error" || (ready ? !readable(ready.image.bitmap) : false),
    [ready, state],
  );
  const empty = doc?.order.length === 0;

  // One render per format and quality, shared by the preview, Copy and Download.
  const file = useMemo(() => {
    if (!ready || !doc || blocked || format === "json" || state === "loading")
      return null;
    return format === "jpeg"
      ? renderImage(doc, ready.image.bitmap, "image/jpeg", quality / 100)
      : renderImage(doc, ready.image.bitmap);
  }, [ready, doc, blocked, format, quality, state]);
  const json = useMemo(
    () =>
      ready && doc
        ? JSON.stringify(toWebAnnotations(doc, ready.hash), null, 2)
        : "",
    [ready, doc],
  );

  const preview = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !file || !ready) return;
      let url: string | null = null;
      let live = true;
      file.then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        img.src = url;
      });
      // Measured once the file shows, and again whenever the page resizes it.
      const measure = () => {
        if (img.src) setScale(img.clientWidth / ready.image.natural.w);
      };
      img.onload = measure;
      const observer = new ResizeObserver(measure);
      observer.observe(img);
      return () => {
        live = false;
        observer.disconnect();
        if (url) URL.revokeObjectURL(url);
      };
    },
    [file, ready],
  );

  const output = natural ? exportSize(natural) : null;
  const size = output ? sizeText(output) : "–";
  const copying = useCopy(
    () => file ?? Promise.reject(new Error("the export isn’t drawn yet.")),
    { name, size },
    setNotice,
    route,
  );

  const choose = (next: Format) => {
    setFormat(next);
    setNotice(null);
    setQuery({ format: next === "png" ? null : next });
  };
  const back = () => go(`#/annotate/${session.key}`);
  const download = (blob: Promise<Blob>, extension: string) =>
    downloadBlob(blob, exportName(name, extension)).then(
      () => setNotice({ text: `Downloaded ${exportName(name, extension)}.` }),
      (error: Error) =>
        setNotice({ text: `Nothing was saved: ${error.message}`, error: true }),
    );
  const downloadCurrent = () => {
    if (format === "json")
      download(
        Promise.resolve(new Blob([json], { type: "application/json" })),
        "json",
      );
    else if (file) download(file, format === "jpeg" ? "jpg" : "png");
  };
  const copyJson = () =>
    navigator.clipboard.writeText(json).then(
      () => setNotice({ text: "Copied the annotations as JSON." }),
      (error: Error) =>
        setNotice({
          text: `Nothing was copied: ${error.message}`,
          error: true,
        }),
    );

  const facts: [string, string][] =
    format === "json"
      ? [
          ["Annotations", String(doc?.order.length ?? 0)],
          ["Image, px", natural ? sizeText(natural) : "–"],
          ["Units", "image pixels"],
        ]
      : [
          ["Output, px", size],
          ["Pixels", output ? mp(output.w, output.h) : "–"],
          ["Budget", `${BUDGET_MP} MP`],
        ];

  let stage: React.ReactNode;
  if (blocked)
    stage = (
      <Plate title="This image can’t be exported here">
        <p className="max-w-[52ch] text-ink-2">
          It came from another site that doesn’t allow it to be read back, so
          the browser blocks the export. Save the image to your computer and
          open the file instead.
        </p>
      </Plate>
    );
  else if (format === "json")
    stage = (
      <pre
        data-testid="export-json"
        tabIndex={0}
        className="max-h-[38rem] overflow-auto p-6 font-mono text-sm text-ink-2"
      >
        {json}
      </pre>
    );
  else
    stage = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- the export itself, a local blob */}
        <img
          ref={preview}
          alt={`The export of ${name}, ${size} px`}
          data-testid="export-preview"
          style={{
            aspectRatio: natural ? `${natural.w} / ${natural.h}` : "3 / 2",
          }}
          // Holds its box, unseen, until the file has been drawn (screen 29).
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
            <span className="text-xs text-ink-2">
              {scale === null ? "Drawing" : "Drawn"}
            </span>
            <span>
              {scale === null
                ? `Waiting for fonts, then drawing ${size}`
                : "from the document at the image’s own size, never from the screen"}
            </span>
          </p>
        </figcaption>
      </>
    );

  const primaryDownload =
    format === "jpeg" || (format === "png" && copying.downloads);

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
            {empty && !blocked && format !== "json" && (
              <Plate title="Nothing drawn on this image yet">
                <p className="text-ink-2">
                  The export would be the picture exactly as you opened it.
                </p>
                <Button variant="outline" size="control" onClick={back}>
                  Back to draw on it
                </Button>
              </Plate>
            )}
            {stage}
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
                const on = id === format;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => choose(id)}
                    className={cn(
                      "grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 border px-4 py-3 text-left hover:border-muted-2",
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

            {format === "jpeg" && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span
                  id="quality-label"
                  className="col-span-full text-sm text-ink-2"
                >
                  Quality
                </span>
                <Slider
                  aria-labelledby="quality-label"
                  min={50}
                  max={100}
                  step={1}
                  value={[shownQuality]}
                  onValueChange={([next]) => setShownQuality(next)}
                  // Encoding is the slow part: once, when the slider is let go.
                  onValueCommit={([next]) => setQuality(next)}
                />
                <output className="min-w-[6ch] text-right font-mono text-sm tabular-nums">
                  {shownQuality}%
                </output>
              </div>
            )}

            <Facts facts={facts} />

            {format === "json" && (
              <p className="text-sm text-ink-2">
                Each annotation points at the image by its SHA-256, so it can be
                re-opened onto the same picture: drop the file on it in the
                editor.
              </p>
            )}
            {format !== "json" && output && output.scale < 1 && natural && (
              <p
                data-testid="over-budget"
                className="border border-swatch-sky p-4 text-sm text-ink-2"
              >
                <strong className="font-medium text-foreground">
                  This image is {nbsp(mp(natural.w, natural.h))}, over the{" "}
                  {nbsp(`${BUDGET_MP} MP`)} budget.
                </strong>{" "}
                It exports at {size} ({(output.scale * 100).toFixed(1)}%) so the
                browser never hands back a blank file.
              </p>
            )}
            {format === "jpeg" && (
              <p className="text-sm text-ink-2">
                JPEG downloads only. Copy always puts a PNG on the clipboard.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {format === "png" && !copying.downloads && (
                <Button size="control" disabled={!file} onClick={copying.copy}>
                  {copying.copied ? "Copied" : "Copy PNG"}
                </Button>
              )}
              {format === "json" && (
                <Button size="control" disabled={!json} onClick={copyJson}>
                  Copy JSON
                </Button>
              )}
              <Button
                variant={primaryDownload ? "default" : "outline"}
                size="control"
                disabled={format === "json" ? !json : !file}
                onClick={downloadCurrent}
              >
                Download {format === "json" ? "JSON" : format.toUpperCase()}
              </Button>
            </div>
            <p
              role="status"
              className={cn(
                "min-h-lh text-sm text-ink-2",
                notice?.error && "text-destructive",
              )}
            >
              {notice?.text ?? (format === "png" ? copying.reason : null)}
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
