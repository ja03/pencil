import type { MyPostsResponse } from "@/contracts/posts";
import { requireUser } from "@/server/auth/service";
import { route } from "@/server/http/route";
import { listOwnPosts } from "@/server/posts/service";

/**
 * GET /api/me/posts: the signed-in author's drafts and published posts, for
 * the My posts dashboard. Most recently changed first, all at once.
 */
export const GET = route(async (request) => {
  const user = await requireUser(request.cookies);
  const body: MyPostsResponse = await listOwnPosts(user);
  return Response.json(body);
});
