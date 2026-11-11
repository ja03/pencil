import { createHash, randomBytes } from "node:crypto";

/** A fresh random token for a link, and the hash that is stored in its place. */
export function newToken(): { token: string; tokenHash: string } {
  // 32 random bytes: unguessable, and URL-safe once base64url-encoded.
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/**
 * The stored form of a token. A plain SHA-256 is enough (no salt or bcrypt):
 * the token is 256 random bits, so there is nothing to brute-force.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
