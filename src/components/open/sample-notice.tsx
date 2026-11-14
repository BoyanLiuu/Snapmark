import { SampleCredit } from "./sample-credit";

/** Shown in the editor when the sample is open: what it is, and the photo's credit. */
export const SampleNotice = () => (
  <div className="flex shrink-0 flex-wrap gap-x-6 gap-y-1 border-t bg-card px-4 py-2 text-sm text-muted-foreground">
    <p>
      This is the sample, with the design file’s sample layers. The rectangle,
      the arrow and the highlighter draw; text and pixelate follow.
    </p>
    <SampleCredit />
  </div>
);
