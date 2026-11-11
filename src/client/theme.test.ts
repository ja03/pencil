import { describe, expect, it } from "vitest";
import { parseTheme, THEME_SCRIPT, themeCookie } from "./theme";

/** Runs the inline head script against a fake document, as the browser would. */
function runScript(cookie: string) {
  const attributes = new Map<string, string>();
  const document = {
    cookie,
    documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    },
  };
  new Function("document", THEME_SCRIPT)(document);
  return attributes.get("data-theme");
}

describe("parseTheme", () => {
  it.each(["light", "dark", "system"] as const)("keeps %s", (theme) => {
    expect(parseTheme(theme)).toBe(theme);
  });

  it.each([undefined, "", "sepia", "DARK"])("falls back to system for %j", (value) => {
    expect(parseTheme(value)).toBe("system");
  });
});

describe("themeCookie", () => {
  it("remembers light and dark for a year on every path", () => {
    expect(themeCookie("dark", false)).toBe(
      "pencil_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });

  it("marks the cookie Secure over HTTPS", () => {
    expect(themeCookie("light", true)).toBe(
      "pencil_theme=light; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
  });

  it("deletes the cookie for system, the default", () => {
    expect(themeCookie("system", false)).toBe("pencil_theme=; Path=/; Max-Age=0; SameSite=Lax");
  });
});

describe("THEME_SCRIPT", () => {
  it("applies a stored light or dark choice before the page paints", () => {
    expect(runScript("pencil_session=abc; pencil_theme=dark")).toBe("dark");
    expect(runScript("pencil_theme=light")).toBe("light");
  });

  it("leaves the system theme to the media query", () => {
    expect(runScript("")).toBeUndefined();
    expect(runScript("pencil_theme=system")).toBeUndefined();
  });

  it("ignores values it doesn't know and look-alike cookie names", () => {
    expect(runScript("pencil_theme=sepia")).toBeUndefined();
    expect(runScript("old_pencil_theme=dark")).toBeUndefined();
  });
});
