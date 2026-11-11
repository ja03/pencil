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
  return rightmost || UNKNOWN_CLIENT_IP;
}
