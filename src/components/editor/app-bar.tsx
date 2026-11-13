import { Button } from "@/components/ui/button";
import { Mark } from "./tools";

/** The app bar over the annotator: wordmark, the Images nav, Shortcuts. */
export const AppBar = () => (
  <header className="flex min-h-14 shrink-0 items-center gap-6 border-b bg-background px-4">
    <a
      href="#/"
      aria-label="Snapmark, open an image"
      className="inline-flex items-center gap-2 text-[1.2rem] font-medium tracking-[-0.02em] whitespace-nowrap text-foreground hover:text-ink-2"
    >
      <Mark className="size-[22px] shrink-0" />
      Snapmark
    </a>
    <nav aria-label="App">
      <a
        href="#/"
        title="The library arrives in M9"
        className="inline-flex min-h-9 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Images
      </a>
    </nav>
    <div className="ml-auto flex items-center gap-3">
      <Button
        variant="outline"
        size="control"
        title="The shortcuts panel arrives in M18"
      >
        Shortcuts
      </Button>
    </div>
  </header>
);
