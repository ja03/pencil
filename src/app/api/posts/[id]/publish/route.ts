import type { NextRequest } from "next/server";
import type { PostResponse } from "@/contracts/posts";
import { requireUser } from "@/server/auth/service";
import { postIdParam } from "@/server/http/params";
import { route } from "@/server/http/route";
import { publishPost } from "@/server/posts/service";

type Context = RouteContext<"/api/posts/[id]/publish">;

/**
 * POST /api/posts/:id/publish: publish your draft so it appears in the feed.
 * Verified users only. Publishing an already published post changes nothing.
 */
export const POST = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser(request.cookies);
  const id = await postIdParam(context.params);
  const body: PostResponse = { post: await publishPost(user, id) };
  return Response.json(body);
});
