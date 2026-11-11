import type {
  CurrentUser,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/contracts/auth";
import type { FieldErrors } from "@/contracts/api-error";
import { runInBackground } from "@/server/background";
import { clock } from "@/server/clock";
import { env } from "@/server/env";
import { ApiError } from "@/server/http/errors";
import { sendMail } from "@/server/mail/mailer";
import { passwordResetEmail, verificationEmail } from "@/server/mail/templates";
import { issueToken, redeemToken } from "@/server/tokens/service";
import {
  createUser,
  findTakenFields,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  replacePassword,
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
  sendVerificationEmail(created.user);
  return startSession(created.user);
}

/** The page an emailed verification link opens. */
export function verificationLink(token: string): string {
  return `${env().APP_URL}/verify/confirm?token=${encodeURIComponent(token)}`;
}

/**
 * Emails `user` a fresh verification link, after the response. A mail
 * failure is logged and never fails the request: the user can resend.
 */
function sendVerificationEmail(user: User): void {
  runInBackground("verification email", async () => {
    const token = await issueToken("VERIFY_EMAIL", user.id);
    await sendMail(
      verificationEmail({ to: user.email, username: user.username, link: verificationLink(token) }),
    );
  });
}

/** Marks the token's user verified. A used, expired or unknown token is a 400. */
export async function verifyEmail(token: string): Promise<void> {
  const userId = await redeemToken("VERIFY_EMAIL", token);
  if (!userId) {
    throw new ApiError(
      "VALIDATION_FAILED",
      "This link has expired or was already used. Ask for a new one.",
    );
  }
  await markEmailVerified(userId, clock.now());
}

/**
 * Sends a new verification link when `email` belongs to an unverified
 * account. The lookup happens after the response too, so known, unknown and
 * already-verified emails get the same reply in the same time.
 */
export function resendVerification(email: string): void {
  runInBackground("resend verification", async () => {
    const user = await findUserByEmail(email);
    if (user && user.emailVerifiedAt === null) sendVerificationEmail(user);
  });
}

/** The page an emailed reset link opens. */
export function passwordResetLink(token: string): string {
  return `${env().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Emails a reset link when `email` belongs to an account. Like resend, the
 * lookup and the send happen after the response, so known and unknown emails
 * get the same reply in the same time.
 */
export function forgotPassword(email: string): void {
  runInBackground("password reset email", async () => {
    const user = await findUserByEmail(email);
    if (!user) return;
    const token = await issueToken("RESET_PASSWORD", user.id);
    await sendMail(
      passwordResetEmail({ to: user.email, username: user.username, link: passwordResetLink(token) }),
    );
  });
}

/**
 * Sets the new password from a reset link and signs this browser in. Bumping
 * `tokenVersion` logs out every other session, so whoever knew the old
 * password loses access. The link came by email, so the user is verified too.
 * A used, expired or unknown token is a 400.
 */
export async function resetPassword({ token, password }: ResetPasswordInput): Promise<SignedIn> {
  const userId = await redeemToken("RESET_PASSWORD", token);
  if (!userId) {
    throw new ApiError(
      "VALIDATION_FAILED",
      "This link has expired or was already used. Ask for a new one.",
    );
  }
  const user = await replacePassword(userId, await hashPassword(password), clock.now());
  return startSession(user);
}

export async function login({ email, password }: LoginInput): Promise<SignedIn> {
  const user = await findUserByEmail(email);
  // Same check, same error, whether or not the account exists.
  if (!(await verifyPassword(password, user?.passwordHash)) || !user) {
    throw new ApiError("UNAUTHENTICATED", "That email and password don't match.");
  }
  return startSession(user);
}

type SessionState<U> =
  | { status: "signed-out" }
  | { status: "stale" }
  | { status: "signed-in"; user: U };

async function readSession(cookies: CookieReader): Promise<SessionState<User>> {
  const claims = await verifySession(cookies.get(SESSION_COOKIE)?.value);
  if (!claims) return { status: "signed-out" };
  const user = await findUserById(claims.userId);
  // A deleted user, or a bumped tokenVersion (password reset, account
  // takeover), makes every token issued before it worthless.
  if (!user || user.tokenVersion !== claims.tokenVersion) return { status: "stale" };
  return { status: "signed-in", user };
}

/**
 * Like `getCurrentUser`, but tells a visitor who never signed in apart from
 * one whose session was revoked (deleted user, bumped tokenVersion), so pages
 * can show the session-expired screen.
 */
export async function getSession(cookies: CookieReader): Promise<SessionState<CurrentUser>> {
  const session = await readSession(cookies);
  return session.status === "signed-in"
    ? { status: "signed-in", user: toCurrentUser(session.user) }
    : session;
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
