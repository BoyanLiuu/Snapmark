import { useSyncExternalStore } from "react";

/** The addresses so far; M10 adds the state parameters and a page for any other address. */
export type Route =
  { page: "open" } | { page: "annotate" | "export"; key: string };

const PATTERN = /^#\/annotate\/([0-9a-f]{12})(\/export)?(?:\?.*)?$/;

export const parseRoute = (hash: string): Route => {
  const match = PATTERN.exec(hash);
  if (!match) return { page: "open" };
  return { page: match[2] ? "export" : "annotate", key: match[1] };
};

export const go = (path: string) => {
  window.location.hash = path;
};

const subscribe = (change: () => void) => {
  window.addEventListener("hashchange", change);
  return () => window.removeEventListener("hashchange", change);
};

/** The route in the address bar, following back, forward and links. */
export const useRoute = () =>
  parseRoute(
    useSyncExternalStore(
      subscribe,
      () => window.location.hash,
      () => "",
    ),
  );
