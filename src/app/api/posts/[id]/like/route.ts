import type { NextRequest } from "next/server";
import type { LikeResponse } from "@/contracts/likes";
import { requireUser } from "@/server/auth/service";
import { postIdParam } from "@/server/http/params";
import { route } from "@/server/http/route";
import { likePost, unlikePost } from "@/server/likes/service";

type Context = RouteContext<"/api/posts/[id]/like">;

/**
 * PUT /api/posts/:id/like: like a published post. Verified users only.
 * Idempotent: liking a post you already like changes nothing.
 */
export const PUT = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser(request.cookies);
  const id = await postIdParam(context.params);
  const body: LikeResponse = await likePost(user, id);
  return Response.json(body);
});

/**
 * DELETE /api/posts/:id/like: take your like back. Idempotent: unliking a
 * post you don't like changes nothing.
 */
export const DELETE = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser(request.cookies);
  const id = await postIdParam(context.params);
  const body: LikeResponse = await unlikePost(user, id);
  return Response.json(body);
});
