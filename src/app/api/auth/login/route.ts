import { loginInput, type AuthResponse } from "@/contracts/auth";
import { login } from "@/server/auth/service";
import { clientIp } from "@/server/http/client-ip";
import { parseJson, route } from "@/server/http/route";
import { setSessionCookie } from "@/server/http/session-cookie";
import { rateLimiters } from "@/server/rate-limit/limits";

/** POST /api/auth/login: check email and password, then set the session cookie. */
export const POST = route(async (request) => {
  // Every attempt counts, before any work, so parallel guesses can't slip
  // past the limit while earlier ones are still checking a password.
  rateLimiters().loginPerIp.consume(clientIp(request.headers));
  const input = await parseJson(request, loginInput);
  rateLimiters().loginPerEmail.consume(input.email);
  const { user, token } = await login(input);
  const body: AuthResponse = { user };
  return setSessionCookie(Response.json(body), request, token);
});
