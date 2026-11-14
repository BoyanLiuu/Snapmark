"use client";

import { sizeText } from "@/lib/text";
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { shortKey } from "@/model/hash";
import { annotationCount, imageCount } from "@/model/describe";
import {
  forgetEverything,
  forgetImage,
  listLibrary,
  type LibraryItem,
} from "@/model/persist";
import { formatWhen } from "../editor/status";

type Listing =
  | { state: "loading" }
  | { state: "blocked" }
  | { state: "ready"; items: LibraryItem[] };

/** The URL lives as long as the img that shows it (a ref with a cleanup, React 19). */
const Thumb = ({ blob }: { blob: Blob }) => {
  const show = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(blob);
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [blob],
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a local blob, not a page asset
    <img
      ref={show}
      alt=""
      className="h-20 w-32 shrink-0 bg-paper-3 object-cover"
    />
  );
};

/** What Forget all is about to do, in one sentence that reads right for one image or many. */
const everythingGoes = (images: number, annotations: number) => {
  const subject =
    images === 1 ? "The one image here leaves" : `All ${images} images leave`;
  const theirs =
    annotations > 0 ? `, with ${annotationCount(annotations)}` : "";
  const files =
    images === 1
      ? "The file on your computer isn’t"
      : "The files on your computer aren’t";
  return `${subject} this browser${theirs}. ${files} touched, and this can’t be undone.`;
};

const Plate = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="grid justify-items-center gap-3 border-y py-24 text-center">
    <h3 className="text-[1.44rem] leading-[1.05] font-medium tracking-[-0.04em]">
      {title}
    </h3>
    {children}
  </div>
);

/**
 * "In this browser": the images kept here, newest first (screen 01), with their loading (04),
 * empty (05) and storage-blocked (06) states. Forget, one image or all of them, asks first (07).
 */
export const Library = ({
  forced,
  onChoose,
}: {
  /** A state from the address, shown instead of what storage holds. */
  forced: "loading" | "empty" | "error" | null;
  onChoose: () => void;
}) => {
  const [listing, setListing] = useState<Listing>(() => {
    if (forced === "empty") return { state: "ready", items: [] };
    if (forced === "error") return { state: "blocked" };
    return { state: "loading" };
  });
  const [forgetting, setForgetting] = useState<LibraryItem | "all" | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (forced) return;
    let live = true;
    listLibrary().then(
      (items) => live && setListing({ state: "ready", items }),
      () => live && setListing({ state: "blocked" }),
    );
    return () => {
      live = false;
    };
  }, [attempt, forced]);

  const reload = () => {
    // A forced state ends by going back to the real list.
    if (forced) return window.location.replace("#/");
    setListing({ state: "loading" });
    setAttempt((n) => n + 1);
  };

  const items = listing.state === "ready" ? listing.items : [];
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const all = forgetting === "all";
  const one = all ? null : forgetting;
  /** Either way the list is read again, whether it worked or not. */
  const forget = () => {
    if (all) forgetEverything().then(reload, reload);
    else if (one) forgetImage(one.hash).then(reload, reload);
  };

  return (
    <section
      aria-labelledby="library-title"
      className="mx-auto grid w-full max-w-[1440px] gap-6 px-16 py-16 max-[60rem]:px-6 max-[40rem]:px-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-t pt-6">
        <h2
          id="library-title"
          className="text-[2.074rem] leading-[1.05] font-medium tracking-[-0.04em]"
        >
          In this browser
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {listing.state === "blocked"
              ? "Couldn’t read this browser’s storage"
              : items.length > 0 &&
                `${imageCount(items.length)}, ${annotationCount(total)}`}
          </p>
          {items.length > 0 && (
            <Button
              variant="outline"
              size="control"
              onClick={() => setForgetting("all")}
            >
              <Trash2 />
              Forget all
            </Button>
          )}
        </div>
      </div>

      {listing.state === "loading" && (
        <ol aria-hidden data-testid="library-loading">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-6 border-b py-3">
              <span className="h-14 w-32 bg-card" />
              <span className="grid w-72 gap-3">
                <span className="h-3 bg-border" />
                <span className="h-1.5 bg-rule-2" />
              </span>
            </li>
          ))}
        </ol>
      )}

      {listing.state === "blocked" && (
        <Plate title="The list didn’t load">
          <p className="max-w-[42ch] text-ink-2">
            A private window can block it. Images still open; they just won’t be
            kept when the tab closes.
          </p>
          <Button
            variant="outline"
            size="control"
            className="mt-2"
            onClick={reload}
          >
            Try again
          </Button>
        </Plate>
      )}

      {listing.state === "ready" && items.length === 0 && (
        <Plate title="No images here yet">
          <p className="max-w-[42ch] text-ink-2">
            Open one and it stays on this device with its annotations, ready the
            next time you drop the same file.
          </p>
          <Button size="control" className="mt-2" onClick={onChoose}>
            Choose an image
          </Button>
        </Plate>
      )}

      {items.length > 0 && (
        <ol className="border-t">
          {items.map((item) => (
            <li
              key={item.hash}
              className="grid grid-cols-[minmax(0,1fr)_10rem_14rem_auto] items-center gap-6 border-b py-3 max-[60rem]:grid-cols-[minmax(0,1fr)_auto]"
            >
              <a
                href={`#/annotate/${shortKey(item.hash)}`}
                className="group flex min-w-0 items-center gap-6 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Thumb blob={item.thumb} />
                <span className="grid min-w-0 gap-1">
                  <span className="truncate text-base font-medium group-hover:underline">
                    {item.name}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">
                    {sizeText(item.natural)}&nbsp;px
                  </span>
                </span>
              </a>
              <span className="text-sm text-ink-2 max-[60rem]:hidden">
                {item.count ? annotationCount(item.count) : "Nothing drawn yet"}
              </span>
              <span className="font-mono text-sm text-ink-2 tabular-nums max-[60rem]:hidden">
                {formatWhen(new Date(item.at))}
              </span>
              <Button
                variant="outline"
                size="control"
                aria-label={`Forget ${item.name}`}
                onClick={() => setForgetting(item)}
              >
                Forget
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className="grid max-w-[64ch] gap-2 text-sm text-muted-foreground">
        <p>
          Each image is filed under the SHA-256 of its bytes, so opening the
          same file brings its annotations back, whatever it is called and
          whichever folder it came from.
        </p>
        <p>
          The picture and its annotations are kept in this browser’s own storage
          (IndexedDB) on this device, saved as you draw. Nothing is uploaded, so
          they aren’t on another computer, another browser, or a private window.
          <strong className="font-normal text-ink-2">
            {" "}
            Clearing this site’s data, or Forget, removes them; the file on your
            computer is never touched.
          </strong>
        </p>
      </div>

      <AlertDialog
        open={forgetting !== null}
        onOpenChange={(open) => !open && setForgetting(null)}
      >
        <AlertDialogContent className="gap-6 border bg-card p-10 ring-0 data-[size=default]:max-w-[36rem] data-[size=default]:sm:max-w-[36rem]">
          <AlertDialogTitle className="text-[1.728rem] leading-[1.05] tracking-[-0.04em]">
            {all ? "Forget every image?" : "Forget this image?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-ink-2">
            {all ? (
              everythingGoes(items.length, total)
            ) : (
              <>
                <span className="font-mono text-foreground">{one?.name}</span>{" "}
                leaves this browser.{" "}
                {one?.count
                  ? `Its ${annotationCount(one.count)} ${one.count === 1 ? "goes" : "go"} with it. `
                  : ""}
                The file on your computer isn’t touched, and this can’t be
                undone.
              </>
            )}
          </AlertDialogDescription>
          <div className="flex gap-3">
            <AlertDialogAction size="control" onClick={forget}>
              {all ? `Forget all ${items.length}` : "Forget image"}
            </AlertDialogAction>
            <AlertDialogCancel size="control">
              {all ? "Keep them" : "Keep it"}
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
