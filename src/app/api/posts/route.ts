import { createPostInput, type PostResponse } from "@/contracts/posts";
import { requireUser } from "@/server/auth/service";
import { parseJson, route } from "@/server/http/route";
import { createDraft } from "@/server/posts/service";

/** POST /api/posts: save a new draft for the signed-in user. */
export const POST = route(async (request) => {
  const user = await requireUser(request.cookies);
  const input = await parseJson(request, createPostInput);
  const body: PostResponse = { post: await createDraft(user, input) };
  return Response.json(body, { status: 201 });
});
