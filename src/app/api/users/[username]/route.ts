import type { NextRequest } from "next/server";
import type { AuthorProfileResponse } from "@/contracts/users";
import { ApiError } from "@/server/http/errors";
import { NO_SUCH_AUTHOR, usernameParam } from "@/server/http/params";
import { route } from "@/server/http/route";
import { findProfile } from "@/server/users/service";

type Context = RouteContext<"/api/users/[username]">;

/** GET /api/users/:username: an author's public profile. No account needed. */
export const GET = route(async (_request: NextRequest, context: Context) => {
  const profile = await findProfile(await usernameParam(context.params));
  if (!profile) throw new ApiError("NOT_FOUND", NO_SUCH_AUTHOR);
  const body: AuthorProfileResponse = { profile };
  return Response.json(body);
});
