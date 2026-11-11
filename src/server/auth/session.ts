import { jwtVerify, SignJWT } from "jose";
import { env } from "@/server/env";

// The session is a JWT in an httpOnly cookie carrying the user id and the
// user's tokenVersion. This module only signs and checks the token (signature
// and expiry); it never touches the database, so the proxy can use it too.
// Whether the session is still current (tokenVersion) is the auth service's job.

export const SESSION_COOKIE = "pencil_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type SessionClaims = { userId: string; tokenVersion: number };

function secret(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

/** Signs a 7-day session token. `now` is injectable so tests can issue old tokens. */
export async function signSession(
  claims: SessionClaims,
  now: Date = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ tv: claims.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .sign(secret());
}

/** The token's claims when its signature and expiry are valid, otherwise null. */
export async function verifySession(
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !Number.isInteger(payload.tv)) return null;
    return { userId: payload.sub, tokenVersion: payload.tv as number };
  } catch {
    return null;
  }
}
