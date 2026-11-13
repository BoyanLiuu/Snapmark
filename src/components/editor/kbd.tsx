import type { ReactNode } from "react";

/** The design file's keycap: a hairline box around a small monospace glyph. */
export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-block min-w-[1.6em] border px-1 text-center font-mono text-[0.85em] leading-normal text-ink-2">
    {children}
  </kbd>
);
