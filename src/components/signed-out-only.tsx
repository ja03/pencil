import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser, type CookieReader } from "@/server/auth/service";

/**
 * Sends a signed-in user to the home page. Only a session that passes the full
 * current-user check counts: a stale cookie (deleted user, bumped tokenVersion)
 * is treated as signed out, so its visitor can still log in again.
 */
export async function leaveIfSignedIn(cookies: CookieReader): Promise<void> {
  if (await getCurrentUser(cookies)) redirect("/");
}

/**
 * Wraps pages a signed-in user has no reason to see (login, register). It
 * reads the session cookie, so render it inside a `<Suspense>` boundary.
 */
export async function SignedOutOnly({ children }: { children: ReactNode }) {
  await leaveIfSignedIn(await cookies());
  return children;
}
