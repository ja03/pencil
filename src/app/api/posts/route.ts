import type { NextRequest } from "next/server";
import { z } from "zod";
import type { FeedResponse, PostResponse } from "@/contracts/posts";
import { requireUser } from "@/server/auth/service";
import { parseJson, route } from "@/server/http/route";
import { cursorParam } from "@/server/posts/cursor";
import { serverPostInputs } from "@/server/posts/inputs";
import { createDraft, listPublished } from "@/server/posts/service";

const feedQuery = z.object({ cursor: cursorParam });

/**
 * GET /api/posts?cursor=: the public feed. Published posts, newest first,
 * 10 a page. No account needed.
 */
export const GET = route(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const { cursor } = feedQuery.parse({ cursor: params.get("cursor") ?? undefined });
  const body: FeedResponse = await listPublished(cursor);
  return Response.json(body);
});

/** POST /api/posts: save a new draft for the signed-in user. */
export const POST = route(async (request) => {
  const user = await requireUser(request.cookies);
  const input = await parseJson(request, serverPostInputs().createPostInput);
  const body: PostResponse = { post: await createDraft(user, input) };
  return Response.json(body, { status: 201 });
});
