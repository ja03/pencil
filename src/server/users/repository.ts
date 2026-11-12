import { Prisma, type User } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type { User };

export function findUserById(id: string): Promise<User | null> {
  return db().user.findUnique({ where: { id } });
}

export function findUserByUsername(username: string): Promise<User | null> {
  return db().user.findUnique({ where: { username } });
}

export function findUserByEmail(email: string): Promise<User | null> {
  return db().user.findUnique({ where: { email } });
}

export function findUserByGoogleId(googleId: string): Promise<User | null> {
  return db().user.findUnique({ where: { googleId } });
}

/** Which of `usernames` already belong to an account. */
export async function findTakenUsernames(usernames: string[]): Promise<Set<string>> {
  const rows = await db().user.findMany({
    where: { username: { in: usernames } },
    select: { username: true },
  });
  return new Set(rows.map((r) => r.username));
}

/** Lets a verified account also sign in with the Google account `googleId`. */
export function linkGoogleAccount(id: string, googleId: string): Promise<User> {
  return db().user.update({ where: { id }, data: { googleId } });
}

/**
 * Hands an unverified account to the Google user who proved they own its
 * email: links Google, removes the password whoever registered it chose,
 * marks the email verified and bumps `tokenVersion` in one transaction,
 * so every session the squatter had stops working the moment the password
 * does. The `emailVerifiedAt: null` guard means an account verified in the
 * meantime is never taken over; that returns null.
 */
export async function takeOverUnverifiedAccount(
  id: string,
  googleId: string,
  at: Date,
): Promise<User | null> {
  const [{ count }, user] = await db().$transaction([
    db().user.updateMany({
      where: { id, emailVerifiedAt: null },
      data: {
        googleId,
        passwordHash: null,
        emailVerifiedAt: at,
        tokenVersion: { increment: 1 },
      },
    }),
    db().user.findUnique({ where: { id } }),
  ]);
  return count === 1 ? user : null;
}

/** Records that the user proved they own their email. A user verified earlier keeps the first date. */
export async function markEmailVerified(id: string, at: Date): Promise<void> {
  await db().user.updateMany({ where: { id, emailVerifiedAt: null }, data: { emailVerifiedAt: at } });
}

/**
 * Sets a new password from an emailed reset link and bumps `tokenVersion`, so
 * every session issued before this stops working. Opening the link proved the
 * user owns their email, so it also marks them verified (keeping the first
 * date if they already were). Returns the updated user.
 */
export async function replacePassword(id: string, passwordHash: string, at: Date): Promise<User> {
  const [, user] = await db().$transaction([
    db().user.updateMany({ where: { id, emailVerifiedAt: null }, data: { emailVerifiedAt: at } }),
    db().user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
  ]);
  return user;
}

export type UniqueUserField = "email" | "username";

/** Which of `email` and `username` already belong to an account. */
export async function findTakenFields(
  email: string,
  username: string,
): Promise<UniqueUserField[]> {
  const rows = await db().user.findMany({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  const taken: UniqueUserField[] = [];
  if (rows.some((r) => r.email === email)) taken.push("email");
  if (rows.some((r) => r.username === username)) taken.push("username");
  return taken;
}

export type CreateUserResult =
  | { ok: true; user: User }
  | { ok: false; taken: UniqueUserField[] };

/**
 * Inserts a user. The unique indexes are the final word on duplicates: if a
 * concurrent request took the email or username first, this reports which.
 */
export async function createUser(data: {
  email: string;
  username: string;
  /** Null for an account that only signs in with Google. */
  passwordHash: string | null;
  googleId?: string;
  emailVerifiedAt?: Date;
}): Promise<CreateUserResult> {
  try {
    return { ok: true, user: await db().user.create({ data }) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, taken: await findTakenFields(data.email, data.username) };
    }
    throw error;
  }
}
