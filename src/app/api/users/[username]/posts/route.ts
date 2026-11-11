import type { NextRequest } from "next/server";
import { z } from "zod";
import type { FeedResponse } from "@/contracts/posts";
import { getCurrentUser } from "@/server/auth/service";
import { ApiError } from "@/server/http/errors";
import { NO_SUCH_AUTHOR, usernameParam } from "@/server/http/params";
import { route } from "@/server/http/route";
import { cursorParam } from "@/server/http/cursor";
import { listPublishedBy } from "@/server/posts/service";

type Context = RouteContext<"/api/users/[username]/posts">;

const pageQuery = z.object({ cursor: cursorParam });

/**
 * GET /api/users/:username/posts?cursor=: an author's published posts,
 * newest first, 10 a page, paged like the feed. No account needed.
 */
export const GET = route(async (request: NextRequest, context: Context) => {
  const username = await usernameParam(context.params);
  const { cursor } = pageQuery.parse({
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
  });
  const body: FeedResponse | null = await listPublishedBy(
    await getCurrentUser(request.cookies),
    username,
    cursor,
  );
  if (!body) throw new ApiError("NOT_FOUND", NO_SUCH_AUTHOR);
  return Response.json(body);
});
