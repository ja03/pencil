import { loginInput, type AuthResponse } from "@/contracts/auth";
import { login } from "@/server/auth/service";
import { parseJson, route } from "@/server/http/route";
import { setSessionCookie } from "@/server/http/session-cookie";

/** POST /api/auth/login: check email and password, then set the session cookie. */
export const POST = route(async (request) => {
  const input = await parseJson(request, loginInput);
  const { user, token } = await login(input);
  const body: AuthResponse = { user };
  return setSessionCookie(Response.json(body), request, token);
});
