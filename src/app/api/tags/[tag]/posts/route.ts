import type { NextRequest } from "next/server";
import { z } from "zod";
import type { FeedResponse } from "@/contracts/posts";
import { getCurrentUser } from "@/server/auth/service";
import { tagParam } from "@/server/http/params";
import { route } from "@/server/http/route";
import { cursorParam } from "@/server/http/cursor";
import { listPublished } from "@/server/posts/service";

type Context = RouteContext<"/api/tags/[tag]/posts">;

const pageQuery = z.object({ cursor: cursorParam });

/**
 * GET /api/tags/:tag/posts?cursor=: published posts with the tag, newest
 * first, 10 a page, paged like the feed. No account needed. A tag nothing
 * uses yet has an empty first page.
 */
export const GET = route(async (request: NextRequest, context: Context) => {
  const tag = await tagParam(context.params);
  const { cursor } = pageQuery.parse({
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
  });
  const body: FeedResponse = await listPublished(await getCurrentUser(request.cookies), cursor, { tag });
  return Response.json(body);
});
