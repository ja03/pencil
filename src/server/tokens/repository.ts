import type { EmailToken, EmailTokenPurpose } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type { EmailToken, EmailTokenPurpose };

/**
 * Stores a new token for `userId`, deleting any of theirs for the same
 * purpose that are still unused, so only the latest emailed link works.
 */
export async function replaceToken(data: {
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await db().$transaction([
    db().emailToken.deleteMany({
      where: { userId: data.userId, purpose: data.purpose, usedAt: null },
    }),
    db().emailToken.create({ data }),
  ]);
}

export function findTokenByHash(
  purpose: EmailTokenPurpose,
  tokenHash: string,
): Promise<EmailToken | null> {
  return db().emailToken.findFirst({ where: { tokenHash, purpose } });
}

/**
 * Marks the token used, unless it already was. False means another request
 * used it first, so of two concurrent redemptions only one succeeds.
 */
export async function markTokenUsed(id: string, usedAt: Date): Promise<boolean> {
  const { count } = await db().emailToken.updateMany({
    where: { id, usedAt: null },
    data: { usedAt },
  });
  return count === 1;
}
