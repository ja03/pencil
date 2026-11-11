/**
 * Where to send the user after logging in: the `next` query value when it is
 * a path on this site, otherwise the feed. Blocks open redirects such as
 * `//evil.example` or `https://evil.example`.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}
