// The reader's theme choice. It lives in a cookie (not localStorage) so the
// server can read it too, e.g. to check the right option on the settings page.
// An inline <head> script applies it before first paint; see
// docs/adr/0001-theme-applied-by-inline-script.md.

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "pencil_theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** A cookie value as a theme. Anything unknown means the default, system. */
export function parseTheme(value: string | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : "system";
}

/**
 * The `document.cookie` assignment that stores `theme`. System is the
 * default, so choosing it deletes the cookie.
 */
export function themeCookie(theme: Theme, secure: boolean): string {
  const value = theme === "system" ? "" : theme;
  const maxAge = theme === "system" ? 0 : ONE_YEAR_SECONDS;
  const parts = [`${THEME_COOKIE}=${value}`, "Path=/", `Max-Age=${maxAge}`, "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Runs synchronously in <head>, before the body paints: sets
 * `data-theme="light|dark"` on <html> from the cookie. With no attribute the
 * CSS follows the system setting.
 */
export const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}`;

function readCookie(): Theme {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  return parseTheme(match?.[1]);
}

function setAttribute(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

/** Switches the page to `theme` now and remembers it on this browser. */
export function applyTheme(theme: Theme) {
  setAttribute(theme);
  document.cookie = themeCookie(theme, location.protocol === "https:");
}

/** Re-applies the stored theme, for when React has reset <html>'s attributes. */
export function reapplyStoredTheme() {
  setAttribute(readCookie());
}
