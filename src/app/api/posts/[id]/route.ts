import type { NextRequest } from "next/server";
import type { PostResponse } from "@/contracts/posts";
import { getCurrentUser, requireUser } from "@/server/auth/service";
import { postIdParam } from "@/server/http/params";
import { parseJson, route } from "@/server/http/route";
import { serverPostInputs } from "@/server/posts/inputs";
import { getPost, updatePost } from "@/server/posts/service";

type Context = RouteContext<"/api/posts/[id]">;

/** GET /api/posts/:id: a published post, or your own draft. */
export const GET = route(async (request: NextRequest, context: Context) => {
  const id = await postIdParam(context.params);
  const body: PostResponse = { post: await getPost(await getCurrentUser(request.cookies), id) };
  return Response.json(body);
});

/** PATCH /api/posts/:id: edit the title, description, cover, content or tags of your post. */
export const PATCH = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser(request.cookies);
  const id = await postIdParam(context.params);
  const input = await parseJson(request, serverPostInputs().updatePostInput);
  const body: PostResponse = { post: await updatePost(user, id, input) };
  return Response.json(body);
});
