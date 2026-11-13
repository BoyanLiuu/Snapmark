"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { decodeImage, type LoadedImage, type OpenResult } from "@/model/image";
import { loadSample } from "@/model/sample";
import { AppBar } from "../editor/app-bar";
import { Hero } from "./hero";
import { SampleCredit } from "./sample-credit";
import { useImageInput } from "./use-image-input";

const kbd =
  "inline-block min-w-[1.6em] border px-1 text-center font-mono text-[0.85em] leading-normal text-ink-2";

/**
 * Screen 01: open an image by choosing it, dropping it anywhere on the page (screen 02) or pasting
 * it. A file Snapmark can't open is refused by name in the help line (screen 03).
 */
export const OpenScreen = ({
  onOpen,
}: {
  /** `sample` is true for the sample photo, which opens with the design file's sample layers. */
  onOpen: (image: LoadedImage, sample: boolean) => void;
}) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [hero, setHero] = useState<LoadedImage | null>(null);

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

  const settle = (result: OpenResult, sample: boolean) => {
    if (result.ok) {
      onOpen(result.image, sample);
      return;
    }
    setRefusal(result.reason);
    chooseRef.current?.focus();
  };

  const open = async (file: File) =>
    settle(await decodeImage(file, file.name || "Pasted image"), false);

  const openSample = async () => settle(await loadSample(), true);

  const dragging = useImageInput(open);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar variant="public" />
      <main className="grid min-h-[calc(100dvh-56px)] items-center border-b py-4 max-[60rem]:min-h-0 max-[60rem]:py-6">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,23rem)_minmax(0,1fr)] items-center gap-8 px-16 max-[60rem]:grid-cols-1 max-[60rem]:px-6 max-[40rem]:px-4">
          <div className="grid content-center gap-6">
            <h1 className="max-w-[11ch] text-[4.3rem] leading-[1.02] font-medium tracking-[-0.04em] text-balance max-[75rem]:text-[3.583rem] max-[40rem]:text-[2.488rem]">
              Annotate to the pixel, then&nbsp;paste
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
              <Button variant="outline" size="control-lg" onClick={openSample}>
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
                if (file) open(file);
              }}
            />
            <p
              aria-live="polite"
              data-testid="open-help"
              className={cn(
                "min-h-lh max-w-[34ch] text-sm text-muted-foreground",
                refusal && "text-destructive",
              )}
            >
              {refusal ?? (
                <>
                  PNG, JPEG or WebP, kept on this device and never uploaded.
                  Paste with <kbd className={kbd}>⌘&nbsp;V</kbd>, or drop a file
                  anywhere here.
                </>
              )}
            </p>
          </div>
          <Hero image={hero} onOpenSample={openSample} />
        </div>
      </main>
      <footer className="px-16 py-6 max-[60rem]:px-6 max-[40rem]:px-4">
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
