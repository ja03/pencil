import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";

// Early redirects only. This checks the session token's signature and expiry,
// never the database, so a revoked (stale tokenVersion) session still passes
// here. The real check is `getCurrentUser`/`requireUser` on the server.

/** Pages that need a session. Later tickets add theirs here. */
const SIGNED_IN_ONLY = ["/settings", "/my-posts", "/write"];
/** Pages a signed-in user has no reason to see. */
const SIGNED_OUT_ONLY = ["/login", "/register"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession =
    (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) !== null;

  if (!hasSession && matches(pathname, SIGNED_IN_ONLY)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (hasSession && matches(pathname, SIGNED_OUT_ONLY)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes do their own auth and answer with JSON, not redirects.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
