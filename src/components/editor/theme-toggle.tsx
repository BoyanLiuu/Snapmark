"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTheme, themeNow } from "@/lib/theme";
import { Hint } from "./hint";

/**
 * Dark or light, remembered. Which icon shows is left to CSS, from the attribute on `<html>`: the
 * page is already in its theme before React runs (lib/theme.ts), and the server has no way to know
 * which, so anything rendered from state here would hydrate as the wrong one.
 */
export const ThemeToggle = () => (
  <Hint text="Dark or light">
    <Button
      variant="outline"
      size="icon-control"
      aria-label="Switch between dark and light"
      onClick={() => setTheme(themeNow() === "light" ? "dark" : "light")}
    >
      <Sun className="[html[data-theme=light]_&]:hidden" />
      <Moon className="hidden [html[data-theme=light]_&]:block" />
    </Button>
  </Hint>
);
