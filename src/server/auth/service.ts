import type { CurrentUser, LoginInput, RegisterInput } from "@/contracts/auth";
import type { FieldErrors } from "@/contracts/api-error";
import { ApiError } from "@/server/http/errors";
import {
  createUser,
  findTakenFields,
  findUserByEmail,
  findUserById,
  type UniqueUserField,
  type User,
} from "@/server/users/repository";
import { hashPassword, verifyPassword } from "./password";
import { SESSION_COOKIE, signSession, verifySession } from "./session";

/**
 * Anything that can read a request cookie: `request.cookies` in a route
 * handler, or `await cookies()` in a Server Component.
 */
export type CookieReader = { get(name: string): { value: string } | undefined };

/** A signed-in user plus the session token to set as their cookie. */
export type SignedIn = { user: CurrentUser; token: string };

const TAKEN_MESSAGES: Record<UniqueUserField, string> = {
  email: "An account with that email already exists.",
  username: "That username is taken.",
};

function takenError(taken: UniqueUserField[]): ApiError {
  const fields: FieldErrors = {};
  for (const field of taken) fields[field] = [TAKEN_MESSAGES[field]];
  const message =
    taken.length === 1 ? TAKEN_MESSAGES[taken[0]] : "That username and email are taken.";
  return new ApiError("CONFLICT", message, fields);
}

export function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
  };
}

async function startSession(user: User): Promise<SignedIn> {
  const token = await signSession({ userId: user.id, tokenVersion: user.tokenVersion });
  return { user: toCurrentUser(user), token };
}

/** Creates an account and signs it in. Input is already validated by the route. */
export async function register({
  email,
  username,
  password,
}: RegisterInput): Promise<SignedIn> {
  const taken = await findTakenFields(email, username);
  if (taken.length > 0) throw takenError(taken);

  const created = await createUser({
    email,
    username,
    passwordHash: await hashPassword(password),
  });
  if (!created.ok) throw takenError(created.taken);
  return startSession(created.user);
}

export async function login({ email, password }: LoginInput): Promise<SignedIn> {  const user = await findUserByEmail(email);
  // Same check, same error, whether or not the account exists.
  if (!(await verifyPassword(password, user?.passwordHash)) || !user) {
    throw new ApiError("UNAUTHENTICATED", "That email and password don't match.");
  }
  return startSession(user);
}

type SessionState =
  | { status: "signed-out" }
  | { status: "stale" }
  | { status: "signed-in"; user: User };

async function readSession(cookies: CookieReader): Promise<SessionState> {
  const claims = await verifySession(cookies.get(SESSION_COOKIE)?.value);
  if (!claims) return { status: "signed-out" };
  const user = await findUserById(claims.userId);
  // A deleted user, or a bumped tokenVersion (password reset, account
  // takeover), makes every token issued before it worthless.
  if (!user || user.tokenVersion !== claims.tokenVersion) return { status: "stale" };
  return { status: "signed-in", user };
}

/**
 * The single server-side check of who is signed in. Verifies the session
 * token, loads the user and rejects a stale tokenVersion. Returns null for
 * visitors; use `requireUser` where a session is mandatory.
 */
export async function getCurrentUser(cookies: CookieReader): Promise<CurrentUser | null> {
  const session = await readSession(cookies);
  return session.status === "signed-in" ? toCurrentUser(session.user) : null;
}

/** Like `getCurrentUser`, but ends the request with 401 when nobody valid is signed in. */
export async function requireUser(cookies: CookieReader): Promise<CurrentUser> {
  const session = await readSession(cookies);
  switch (session.status) {
    case "signed-in":
      return toCurrentUser(session.user);
    case "stale":
      throw new ApiError("UNAUTHENTICATED", "Your session has expired. Please log in again.");
    case "signed-out":
      throw new ApiError("UNAUTHENTICATED", "Please log in to continue.");
  }
}
