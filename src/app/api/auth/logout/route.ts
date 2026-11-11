import { route } from "@/server/http/route";
import { clearSessionCookie } from "@/server/http/session-cookie";

/** POST /api/auth/logout: clear the session cookie. Safe to call when signed out. */
export const POST = route(async (request) =>
  clearSessionCookie(new Response(null, { status: 204 }), request),
);
