"use client";

import { useLayoutEffect } from "react";
import { reapplyStoredTheme, THEME_SCRIPT } from "@/client/theme";

/**
 * Applies the theme cookie before first paint. Rendered in <head> so the
 * browser runs it while parsing, before the body exists.
 *
 * The script only needs to run from the server's HTML, so the client renders
 * it inert (`text/plain`), which also keeps React from warning about script
 * tags. In development, Strict Mode remounts <html> and drops the attribute;
 * the layout effect puts it back before paint (a no-op in production).
 */
export function ThemeScript() {
  useLayoutEffect(reapplyStoredTheme, []);
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
