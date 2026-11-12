/** The key used when a request carries no usable client address (local dev, no proxy). */
export const UNKNOWN_CLIENT_IP = "unknown";

/**
 * The client's IP address: the rightmost `X-Forwarded-For` entry. Render's
 * proxy appends the address it received the connection from, so that entry
 * can't be forged; anything to its left came from the client and is ignored.
 *
 * Every rate limit keyed by IP reads it through here and nowhere else.
 */
export function clientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  const rightmost = forwardedFor?.split(",").at(-1)?.trim();
  const ip = rightmost || UNKNOWN_CLIENT_IP;
  logFirstForwardedFor(forwardedFor, ip);
  return ip;
}

let loggedForwardedFor = false;

/**
 * Logs the first `X-Forwarded-For` header this process sees in production,
 * with the address picked from it, so the Render logs show whether the
 * rightmost-entry assumption above holds. Once per process: enough to check
 * without logging every visitor's address.
 */
function logFirstForwardedFor(raw: string | null, ip: string): void {
  if (loggedForwardedFor || process.env.NODE_ENV !== "production") return;
  loggedForwardedFor = true;
  console.info(
    `[client-ip] first X-Forwarded-For in this process: ${JSON.stringify(raw)}; rate limits key on ${JSON.stringify(ip)}`,
  );
}
