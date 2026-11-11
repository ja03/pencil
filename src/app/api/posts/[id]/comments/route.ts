import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  createCommentInput,
  type CommentResponse,
  type CommentsResponse,
} from "@/contracts/comments";
import { requireUser } from "@/server/auth/service";
import { createComment, listComments } from "@/server/comments/service";
import { clientIp } from "@/server/http/client-ip";
import { cursorParam } from "@/server/http/cursor";
import { postIdParam } from "@/server/http/params";
import { parseJson, route } from "@/server/http/route";
import { rateLimiters } from "@/server/rate-limit/limits";

type Context = RouteContext<"/api/posts/[id]/comments">;

const pageQuery = z.object({ cursor: cursorParam });

/**
 * GET /api/posts/:id/comments?cursor=: a published post's top-level
 * comments, newest first, 20 a page, each with all its replies, oldest
 * first. No account needed.
 */
export const GET = route(async (request: NextRequest, context: Context) => {
  const id = await postIdParam(context.params);
  const { cursor } = pageQuery.parse({
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
  });
  const body: CommentsResponse = await listComments(id, cursor);
  return Response.json(body);
});

/**
 * POST /api/posts/:id/comments: comment on a published post, or reply to
 * one of its top-level comments with `parentId`. Verified users only, and
 * rate-limited per client IP.
 */
export const POST = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser(request.cookies);
  rateLimiters().commentPerIp.consume(clientIp(request.headers));
  const id = await postIdParam(context.params);
  const input = await parseJson(request, createCommentInput);
  const body: CommentResponse = { comment: await createComment(user, id, input) };
  return Response.json(body, { status: 201 });
});
