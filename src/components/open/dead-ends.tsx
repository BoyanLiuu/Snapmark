import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppBar } from "../editor/app-bar";
import { CORNERS } from "./corners";

const DeadEnd = ({
  title,
  address,
  children,
  onOpen,
}: {
  title: string;
  address?: string;
  children: ReactNode;
  onOpen: () => void;
}) => (
  <div className="flex min-h-dvh flex-col">
    <AppBar variant="bare" onHome={onOpen} />
    <main className="grid flex-1 place-items-center p-6">
      <div className={cn(CORNERS, "w-[min(40rem,100%)]")}>
        <section className="grid justify-items-start gap-6 bg-card px-16 py-16 max-[40rem]:px-6">
          <div className="grid gap-4">
            <h1 className="max-w-[13ch] text-[2.488rem] leading-[1.05] font-medium tracking-[-0.04em]">
              {title}
            </h1>
            {address && (
              <p className="font-mono text-sm break-all text-ink-2">
                {address}
              </p>
            )}
          </div>
          <p className="text-ink-2">{children}</p>
          <Button size="control" onClick={onOpen}>
            Open an image
          </Button>
        </section>
      </div>
    </main>
  </div>
);

/** Screen 32: an address for an image this browser doesn't have. */
export const NotInBrowser = ({
  address,
  onOpen,
}: {
  address: string;
  onOpen: () => void;
}) => (
  <DeadEnd
    title="This image isn’t in this browser"
    address={address}
    onOpen={onOpen}
  >
    Snapmark keeps each image on the device that opened it, filed under the
    SHA-256 of its bytes, so a link from another computer can’t bring it here.
    Open the file on this one and its annotations come back if this browser has
    them.
  </DeadEnd>
);

/** Screen 33: no page at this address. */
export const NoPage = ({ onOpen }: { onOpen: () => void }) => (
  <DeadEnd title="There’s no page at this address" onOpen={onOpen}>
    Check the address, or start from an image.
  </DeadEnd>
);
