import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";

// Early redirects only. This checks the session token's signature and expiry,
// never the database, so a revoked (stale tokenVersion) session still passes
// here. The real check is `getCurrentUser`/`requireUser` on the server.
//
// That is why the proxy never sends anyone *away* from the login and register
// pages: it can't tell a stale cookie from a valid one, and bouncing a stale
// session off /login would leave its visitor unable to log in again. Those
// pages do that redirect themselves, after the full check (`SignedOutOnly`).

/** Pages that need a session. Later tickets add theirs here. */
const SIGNED_IN_ONLY = ["/settings", "/my-posts", "/write"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!matches(pathname, SIGNED_IN_ONLY)) return NextResponse.next();

  const hasSession =
    (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) !== null;
  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes do their own auth and answer with JSON, not redirects.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
