import type { NextRequest } from "next/server";
import { z } from "zod";
import { updatePostInput, type PostResponse } from "@/contracts/posts";
import { getCurrentUser, requireUser } from "@/server/auth/service";
import { ApiError } from "@/server/http/errors";
import { parseJson, route } from "@/server/http/route";
import { getPost, updatePost } from "@/server/posts/service";

type Context = RouteContext<"/api/posts/[id]">;

/** The post id from the URL. Anything that isn't a post id can't be a post: 404. */
async function postId(context: Context): Promise<string> {
  const { id } = await context.params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new ApiError("NOT_FOUND", "That post doesn't exist.");
  return parsed.data;
}

/** GET /api/posts/:id: a published post, or your own draft. */
export const GET = route(async (request: NextRequest, context: Context) => {
  const id = await postId(context);
  const body: PostResponse = { post: await getPost(await getCurrentUser(request.cookies), id) };
  return Response.json(body);
});

/** PATCH /api/posts/:id: edit the title, description or content of your post. */
export const PATCH = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser(request.cookies);
  const id = await postId(context);
  const input = await parseJson(request, updatePostInput);
  const body: PostResponse = { post: await updatePost(user, id, input) };
  return Response.json(body);
});
