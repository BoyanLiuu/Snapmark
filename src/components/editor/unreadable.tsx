import { Button } from "@/components/ui/button";

/** Screen 11: the stored annotations didn't load. The picture is fine and stays usable. */
export const Unreadable = ({
  retry,
  startFresh,
}: {
  retry: () => void;
  startFresh: () => void;
}) => (
  <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--veil)] p-6">
    <div
      role="alertdialog"
      aria-labelledby="unreadable-title"
      className="grid w-[min(36rem,100%)] justify-items-center gap-3 border bg-card px-10 py-16 text-center"
    >
      <h2
        id="unreadable-title"
        className="text-[1.44rem] leading-[1.05] font-medium tracking-[-0.04em]"
      >
        Couldn’t read this image’s annotations
      </h2>
      <p className="text-ink-2">
        This browser’s storage didn’t answer. The picture itself is fine.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button size="control" onClick={retry}>
          Try again
        </Button>
        <Button variant="outline" size="control" onClick={startFresh}>
          Start without them
        </Button>
      </div>
    </div>
  </div>
);
