import { Button } from "@/components/ui/button";
import { AppBar } from "../editor/app-bar";
import { cn } from "@/lib/utils";
import { CORNERS } from "./corners";

/** Screen 32: an address for an image this browser doesn't have. */
export const NotInBrowser = ({
  address,
  onOpen,
}: {
  address: string;
  onOpen: () => void;
}) => (
  <div className="flex min-h-dvh flex-col">
    <AppBar variant="public" onHome={onOpen} />
    <main className="grid flex-1 place-items-center p-6">
      <div className={cn(CORNERS, "w-[min(40rem,100%)]")}>
        <section className="grid justify-items-start gap-6 bg-card px-16 py-16 max-[40rem]:px-6">
          <div className="grid gap-4">
            <h1 className="max-w-[13ch] text-[2.488rem] leading-[1.05] font-medium tracking-[-0.04em]">
              This image isn’t in this browser
            </h1>
            <p className="font-mono text-sm text-ink-2">{address}</p>
          </div>
          <p className="text-ink-2">
            Snapmark keeps each image on the device that opened it, filed under
            the SHA-256 of its bytes, so a link from another computer can’t
            bring it here. Open the file on this one and its annotations come
            back if this browser has them.
          </p>
          <Button size="control" onClick={onOpen}>
            Open an image
          </Button>
        </section>
      </div>
    </main>
  </div>
);
