import type { NextRequest } from "next/server";
import { editCommentInput, type CommentResponse } from "@/contracts/comments";
import { requireUser } from "@/server/auth/service";
import { deleteComment, editComment } from "@/server/comments/service";
import { commentIdParam } from "@/server/http/params";
import { parseJson, route } from "@/server/http/route";

type Context = RouteContext<"/api/comments/[id]">;

/** PATCH /api/comments/:id: change the text of your comment. It shows as edited. */
export const PATCH = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser(request.cookies);
  const id = await commentIdParam(context.params);
  const input = await parseJson(request, editCommentInput);
  const body: CommentResponse = { comment: await editComment(user, id, input) };
  return Response.json(body);
});

/**
 * DELETE /api/comments/:id: delete your comment, or any comment on your
 * post. With replies it stays as "[comment deleted]"; without, it is gone.
 * 204 on success.
 */
export const DELETE = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser(request.cookies);
  const id = await commentIdParam(context.params);
  await deleteComment(user, id);
  return new Response(null, { status: 204 });
});
