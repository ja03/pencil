import { googleSignInInput, type AuthResponse } from "@/contracts/auth";
import { signInWithGoogle } from "@/server/auth/service";
import { clientIp } from "@/server/http/client-ip";
import { parseJson, route } from "@/server/http/route";
import { setSessionCookie } from "@/server/http/session-cookie";
import { rateLimiters } from "@/server/rate-limit/limits";

/**
 * POST /api/auth/google: sign in with the ID token from Google's button,
 * creating or linking the account, then set the session cookie.
 */
export const POST = route(async (request) => {
  rateLimiters().loginPerIp.consume(clientIp(request.headers));
  const input = await parseJson(request, googleSignInInput);
  const { user, token } = await signInWithGoogle(input);
  const body: AuthResponse = { user };
  return setSessionCookie(Response.json(body), request, token);
});
