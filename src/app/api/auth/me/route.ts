import type { AuthResponse } from "@/contracts/auth";
import { requireUser } from "@/server/auth/service";
import { route } from "@/server/http/route";

/** GET /api/auth/me: the signed-in user, or 401. */
export const GET = route(async (request) => {
  const body: AuthResponse = { user: await requireUser(request.cookies) };
  return Response.json(body);
});
