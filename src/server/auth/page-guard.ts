import { redirect } from "next/navigation";
import type { CurrentUser } from "@/contracts/auth";
import { getSession, type CookieReader } from "./service";

/**
 * The signed-in user for a page that needs one. Anyone else leaves, and comes
 * back to `next` after logging in: a visitor goes to log in, while a revoked
 * session (password reset, deleted user) goes to the session-expired screen
 * first, so its owner knows why they were logged out.
 *
 * The proxy has already turned away visitors with no valid token; this is the
 * full check it can't make without the database.
 */
export async function requirePageUser(cookies: CookieReader, next: string): Promise<CurrentUser> {
  const session = await getSession(cookies);
  if (session.status === "signed-in") return session.user;
  const page = session.status === "stale" ? "/session-expired" : "/login";
  redirect(`${page}?next=${encodeURIComponent(next)}`);
}
