import { registerInput, type AuthResponse } from "@/contracts/auth";
import { register } from "@/server/auth/service";
import { clientIp } from "@/server/http/client-ip";
import { parseJson, route } from "@/server/http/route";
import { setSessionCookie } from "@/server/http/session-cookie";
import { rateLimiters } from "@/server/rate-limit/limits";

/** POST /api/auth/register: create an account and sign it in. */
export const POST = route(async (request) => {
  rateLimiters().registerPerIp.consume(clientIp(request.headers));
  const input = await parseJson(request, registerInput);
  const { user, token } = await register(input);
  const body: AuthResponse = { user };
  return setSessionCookie(Response.json(body, { status: 201 }), request, token);
});
