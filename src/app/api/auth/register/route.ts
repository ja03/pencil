import { registerInput, type AuthResponse } from "@/contracts/auth";
import { register } from "@/server/auth/service";
import { parseJson, route } from "@/server/http/route";
import { setSessionCookie } from "@/server/http/session-cookie";

/** POST /api/auth/register: create an account and sign it in. */
export const POST = route(async (request) => {
  const input = await parseJson(request, registerInput);
  const { user, token } = await register(input);
  const body: AuthResponse = { user };
  return setSessionCookie(Response.json(body, { status: 201 }), request, token);
});
