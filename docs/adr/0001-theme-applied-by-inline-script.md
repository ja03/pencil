# 1. The theme cookie is applied by an inline script, not read by the server

Status: accepted (#17)

## Context

The spec asks for a light / dark / system theme "stored in a cookie so the server renders the right theme without a flash". The app runs with Cache Components on: every page streams from a static shell, and only the parts inside `<Suspense>` wait on the request.

The theme has to be on `<html>`, which is in the root layout's static shell. Reading the cookie there with `cookies()` would make the whole document request-time, so every page would block until the root layout resolved instead of streaming.

## Decision

- The choice lives in the `pencil_theme` cookie (`light` or `dark`, one year, `SameSite=Lax`, readable by scripts). System is the default, so choosing it deletes the cookie.
- An inline `<script>` in the root layout's `<head>` reads the cookie and sets `data-theme` on `<html>` while the browser parses the page, before first paint. This is the approach in Next's "Preventing flash before hydration" guide.
- Dark mode is the `@custom-variant dark` block in `src/app/globals.css`. It matches `[data-theme="dark"]`, and, inside a `prefers-color-scheme: dark` media query, `:root` with no `data-theme`. So with no cookie the page follows the system setting through CSS alone, and `data-theme` pins it to one side. The dark token values hang off that variant.
- The tokens are not `light-dark()` pairs, though that was the first plan. Next's CSS step lowers `light-dark()` inside custom properties to a plain `prefers-color-scheme` media query and drops the `data-theme` overrides, so a reader who picked light on a dark system (or the reverse) got the system theme anyway.
- The settings page is request-time anyway, so it reads the cookie on the server to check the right option.

## Consequences

- No flash on any page, and the static shell stays static.
- A strict Content Security Policy would need a nonce for the inline script.
- In development, Strict Mode resets `<html>`'s attributes on its remount. `ThemeScript` re-applies the cookie in a layout effect. It is a no-op in production.
- The cookie isn't `HttpOnly`, by design: the head script must read it. It holds no secret.
- Recheck `light-dark()` after a Next upgrade. If Next stops lowering it in custom properties, the tokens could go back to `light-dark()` pairs with `color-scheme` set from `data-theme`, and the `@custom-variant dark` block could go.
