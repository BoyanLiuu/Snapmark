import { useSyncExternalStore } from "react";

/**
 * Every screen has an address (IMPLEMENTATION_PLAN.md M10): the page in the path, the state in
 * the query. `/annotate/` with anything but a 12-digit key is an image this browser can't have
 * (screen 32); any other unknown path is screen 33.
 */
export type Route = { query: URLSearchParams } & (
  | { page: "open" | "nowhere" }
  | { page: "annotate" | "export" | "missing"; key: string }
);

export const parseRoute = (hash: string): Route => {
  const [rawPath, qs = ""] = hash.replace(/^#/, "").split("?");
  const path = rawPath.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(qs);
  if (path === "/") return { page: "open", query };
  const image = /^\/annotate\/([^/]+)(\/export)?$/.exec(path);
  if (image && /^[0-9a-f]{12}$/.test(image[1]))
    return { page: image[2] ? "export" : "annotate", key: image[1], query };
  if (path.startsWith("/annotate/"))
    return { page: "missing", key: path.split("/")[2], query };
  return { page: "nowhere", query };
};

/** The key of the image this address opens, if it opens one. */
export const imageKey = (route: Route) =>
  route.page === "annotate" || route.page === "export" ? route.key : null;

export const go = (path: string) => {
  window.location.hash = path;
};

/**
 * Rewrites the address's state in place, without a history entry, so Back still leaves the image.
 * The history state is kept: Next.js keeps its own there.
 */
export const setQuery = (changes: Record<string, string | null>) => {
  const [path, qs = ""] = window.location.hash.split("?");
  const query = new URLSearchParams(qs);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) query.delete(name);
    else query.set(name, value);
  }
  const next = query.toString().replaceAll("%2C", ",");
  const hash = next ? `${path}?${next}` : path;
  if (hash !== window.location.hash)
    window.history.replaceState(window.history.state, "", hash);
};

/** A state parameter read when the page opens, if it is one of `allowed`. */
export const forced = <const T extends string>(
  route: Route,
  name: string,
  allowed: readonly T[],
) => {
  const value = route.query.get(name);
  return (allowed as readonly string[]).includes(value ?? "")
    ? (value as T)
    : null;
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
