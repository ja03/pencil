import { clock } from "@/server/clock";
import { findTokenByHash, markTokenUsed, replaceToken, type EmailTokenPurpose } from "./repository";
import { hashToken, newToken } from "./token";

const HOUR = 60 * 60 * 1000;

/** How long an emailed link works after it is sent. */
export const TOKEN_LIFETIME_MS: Record<EmailTokenPurpose, number> = {
  VERIFY_EMAIL: 24 * HOUR,
};

/**
 * Creates a single-use token for `userId` and returns it for the email link.
 * Only its hash is stored. Earlier unused tokens for the same purpose stop
 * working, so only the latest email's link does.
 */
export async function issueToken(purpose: EmailTokenPurpose, userId: string): Promise<string> {
  const { token, tokenHash } = newToken();
  const expiresAt = new Date(clock.now().getTime() + TOKEN_LIFETIME_MS[purpose]);
  await replaceToken({ userId, purpose, tokenHash, expiresAt });
  return token;
}

/**
 * Uses up `token` and returns the id of the user it was issued to, or null
 * when it is unknown, for another purpose, expired or already used. Callers
 * don't learn which, since none of them lets the link work.
 */
export async function redeemToken(
  purpose: EmailTokenPurpose,
  token: string,
): Promise<string | null> {
  const row = await findTokenByHash(purpose, hashToken(token));
  if (!row || row.usedAt) return null;
  const now = clock.now();
  if (row.expiresAt.getTime() <= now.getTime()) return null;
  return (await markTokenUsed(row.id, now)) ? row.userId : null;
}
