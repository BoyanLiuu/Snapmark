/**
 * Dark or light. The design file is dark, so dark is what you get until you ask for light here;
 * the computer's own preference is deliberately not read, so the app looks like itself on a
 * light-mode machine. A choice made here outlasts the visit. The attribute is set on `<html>`
 * before the first paint by the script below, so the page never flashes the other theme.
 */

export type Theme = "dark" | "light";

const KEY = "snapmark:theme";
/** Subscribed through `onThemeChange` below, which is the only way in. */
const THEME_EVENT = "snapmark:themechange";

export const themeNow = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

export const setTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // A browser that won't keep it simply starts from the computer's preference again.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
};

/** Subscribes whatever has to be drawn again in the new colours: the canvases. */
export const onThemeChange = (fn: () => void) => {
  window.addEventListener(THEME_EVENT, fn);
  return () => window.removeEventListener(THEME_EVENT, fn);
};

/**
 * Runs before the first paint, from `<head>`: the stored choice, or dark. Inline and tiny on
 * purpose — anything slower would show the wrong theme first.
 */
export const THEME_SCRIPT = `try{document.documentElement.dataset.theme=localStorage.getItem("${KEY}")||"dark"}catch(e){}`;
