import { resetPasswordInput, type AuthResponse } from "@/contracts/auth";
import { resetPassword } from "@/server/auth/service";
import { parseJson, route } from "@/server/http/route";
import { setSessionCookie } from "@/server/http/session-cookie";

/**
 * POST /api/auth/reset-password: use the token from a reset link to set a new
 * password. Every other session stops working; this browser gets a fresh one.
 */
export const POST = route(async (request) => {
  const input = await parseJson(request, resetPasswordInput);
  const { user, token } = await resetPassword(input);
  const body: AuthResponse = { user };
  return setSessionCookie(Response.json(body), request, token);
});
