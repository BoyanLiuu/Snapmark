"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { reducedMotion } from "@/lib/animate";
import { cn } from "@/lib/utils";
import { forced, type Route } from "@/lib/route";
import { refusalOf, type LoadedImage } from "@/model/image";
import { loadSample } from "@/model/sample";
import { AppBar } from "../editor/app-bar";
import { Kbd } from "../editor/kbd";
import { Hero } from "./hero";
import { Library } from "./library";
import { SampleCredit } from "./sample-credit";
import { TechText } from "./tech-text";
import { useImageInput } from "./use-image-input";

/** The headline, a line to a canvas. The reader hears the whole sentence from the `sr-only` copy. */
const HEADLINE = ["Annotate", "to the pixel,", "then paste"];
/** Seconds a word spends under the selection frame as the headline is placed. */
const WORD_SECONDS = 0.5;
/** A word takes as long whichever line it is on, so a line's share is its own word count. */
const LINE_SECONDS = HEADLINE.map(
  (line) => line.split(" ").length * WORD_SECONDS,
);
const LINE_START = LINE_SECONDS.map((_, i) =>
  LINE_SECONDS.slice(0, i).reduce((total, seconds) => total + seconds, 0),
);

/**
 * Screen 01: open an image by choosing it, dropping it anywhere on the page (screen 02) or pasting
 * it, or pick one kept in this browser. A file Snapmark can't open is refused by name in the help
 * line (screen 03).
 */
export const OpenScreen = ({
  route,
  refusal,
  onFile,
  onSample,
}: {
  route: Route;
  /** Why the last file couldn't be opened, or null. */
  refusal: string | null;
  onFile: (file: File) => void;
  onSample: () => void;
}) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const [hero, setHero] = useState<LoadedImage | null>(null);
  /**
   * How many of the headline's lines are writing themselves. A line mounts when its turn comes, so
   * the frame walks one line's words at a time instead of all three at once; the empty box keeps
   * its height, so nothing moves when the next one arrives. It starts at none on both the server
   * and the client, because the first render has no way to know the motion preference.
   */
  const [writing, setWriting] = useState(0);

  useEffect(() => {
    // With reduced motion every line arrives at once, and each draws itself solid without an intro.
    const timers = HEADLINE.map((_, i) =>
      setTimeout(
        () => setWriting(i + 1),
        reducedMotion() ? 0 : LINE_START[i] * 1000,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // The figure's own copy of the sample; the editor decodes its own, so each closes what it made.
  useEffect(() => {
    let live = true;
    let made: LoadedImage | null = null;
    loadSample().then((result) => {
      if (!result.ok) return;
      made = result.image;
      if (live) setHero(result.image);
      else result.image.bitmap.close();
    });
    return () => {
      live = false;
      made?.bitmap.close();
    };
  }, []);

  // A refusal moves focus back to the way out of it.
  useEffect(() => {
    if (refusal) chooseRef.current?.focus();
  }, [refusal]);

  const dragging = useImageInput(onFile);
  // ?drop=heic shows screen 03 as if one had been dropped; ?state=… forces the list's states.
  const shownRefusal =
    refusal ??
    (route.query.get("drop") === "heic"
      ? refusalOf("IMG_4021.HEIC", "heic")
      : null);
  const listing = forced(route, "state", ["loading", "empty", "error"]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar variant="public" />
      <main className="flex-1">
        <div className="grid min-h-[calc(100dvh-56px)] items-center border-b py-4 max-[60rem]:min-h-0 max-[60rem]:py-6">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,23rem)_minmax(0,1fr)] items-center gap-8 px-16 max-[60rem]:grid-cols-1 max-[60rem]:px-6 max-[40rem]:px-4">
            <div className="grid content-center gap-6">
              <h1>
                <span className="sr-only">
                  Annotate to the pixel, then paste
                </span>
                <span aria-hidden className="grid">
                  {HEADLINE.map((line, i) => (
                    /*
                     * TechText fits the type to 66% of its box's height, so each line is given the
                     * room its 4.3rem needs rather than a font size of its own: one `fontSize`,
                     * and the box's height at each width lands it on the design's type ramp.
                     * It also insets a left-aligned wordmark by 5% of its own width, so the box is
                     * widened by that much and pulled back, to start where the paragraph does.
                     */
                    <span
                      key={line}
                      className="-ml-[5.3%] h-[6.2rem] w-[105.3%] max-[75rem]:h-[5.15rem] max-[40rem]:h-[3.6rem]"
                    >
                      {i < writing && (
                        <TechText
                          text={line}
                          align="left"
                          fontSize={69}
                          fontWeight={500}
                          letterSpacing={-0.04}
                          sweep={false}
                          // The per-letter readout is drawn above the frame, where the box the
                          // type needs leaves no room for it, so it would be clipped.
                          labels={false}
                          unit="word"
                          intro="type"
                          introDuration={LINE_SECONDS[i]}
                        />
                      )}
                    </span>
                  ))}
                </span>
              </h1>
              <p className="max-w-[30ch] text-[1.2rem] text-ink-2">
                Draw on a screenshot or a photo, then copy it at full size.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  ref={chooseRef}
                  size="control-lg"
                  onClick={() => pickerRef.current?.click()}
                >
                  Choose an image
                </Button>
                <Button variant="outline" size="control-lg" onClick={onSample}>
                  Open the sample
                </Button>
              </div>
              {/* HEIC is offered on purpose, so choosing one gets the explanation, not silence. */}
              <input
                ref={pickerRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,.heic"
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onFile(file);
                }}
              />
              <p
                aria-live="polite"
                data-testid="open-help"
                className={cn(
                  "min-h-lh max-w-[34ch] text-sm text-muted-foreground",
                  shownRefusal && "text-destructive",
                )}
              >
                {shownRefusal ?? (
                  <>
                    PNG, JPEG or WebP, kept on this device and never uploaded.
                    Paste with <Kbd>⌘&nbsp;V</Kbd>, or drop a file anywhere
                    here.
                  </>
                )}
              </p>
            </div>
            <Hero image={hero} onOpenSample={onSample} />
          </div>
        </div>
        <Library
          key={listing ?? "stored"}
          forced={listing}
          onChoose={() => pickerRef.current?.click()}
        />
      </main>
      <footer className="border-t px-16 py-6 max-[60rem]:px-6 max-[40rem]:px-4">
        <SampleCredit className="text-xs text-muted-foreground" />
      </footer>

      <div
        aria-hidden
        data-testid="drop-veil"
        data-active={dragging || undefined}
        className={cn(
          "pointer-events-none fixed inset-x-0 top-14 bottom-0 z-50 grid place-items-center bg-[var(--veil)] opacity-0 outline-2 -outline-offset-24 outline-primary transition-opacity duration-200 outline-dashed",
          dragging && "opacity-100",
        )}
      >
        <p className="text-[2.488rem] font-medium tracking-[-0.03em]">
          Drop to open
        </p>
      </div>
    </div>
  );
};
