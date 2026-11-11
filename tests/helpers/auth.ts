import { randomUUID } from "node:crypto";
import type { User } from "@/generated/prisma/client";
import { hashPassword } from "@/server/auth/password";
import { SESSION_COOKIE, signSession } from "@/server/auth/session";
import { db } from "@/server/db";

export const TEST_PASSWORD = "correct-horse-battery";

type UserOverrides = {
  email?: string;
  username?: string;
  password?: string;
  /** Defaults to false. Pass true for a user who may publish, like and comment. */
  verified?: boolean;
};

/** Inserts a user who can log in with `TEST_PASSWORD` (or `password`). */
export async function createUser(overrides: UserOverrides = {}): Promise<User> {
  const suffix = randomUUID().slice(0, 8);
  return db().user.create({
    data: {
      email: overrides.email ?? `user-${suffix}@example.com`,
      username: overrides.username ?? `user_${suffix}`,
      passwordHash: await hashPassword(overrides.password ?? TEST_PASSWORD),
      emailVerifiedAt: overrides.verified ? new Date() : null,
    },
  });
}

/** A `cookie` header value carrying a valid session for `user`. */
export async function sessionCookieFor(user: User, now?: Date): Promise<string> {
  const token = await signSession({ userId: user.id, tokenVersion: user.tokenVersion }, now);
  return `${SESSION_COOKIE}=${token}`;
}

/**
 * Creates a user and returns them with headers that authenticate as them:
 *
 *   const { user, headers } = await signedIn({ verified: true });
 *   const res = await call(POST, { method: "POST", headers, body });
 */
export async function signedIn(overrides: UserOverrides = {}) {
  const user = await createUser(overrides);
  const cookie = await sessionCookieFor(user);
  return { user, cookie, headers: { cookie } };
}
