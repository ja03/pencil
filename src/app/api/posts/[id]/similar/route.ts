import type { NextRequest } from "next/server";
import type { RecommendationsResponse } from "@/contracts/recommendations";
import { getCurrentUser } from "@/server/auth/service";
import { postIdParam } from "@/server/http/params";
import { route } from "@/server/http/route";
import { similarTo } from "@/server/recommendations/service";

type Context = RouteContext<"/api/posts/[id]/similar">;

/** GET /api/posts/:id/similar: "More like this", 3 posts related to a published post. No account needed. */
export const GET = route(async (request: NextRequest, context: Context) => {
  const id = await postIdParam(context.params);
  const body: RecommendationsResponse = await similarTo(await getCurrentUser(request.cookies), id);
  return Response.json(body);
});
