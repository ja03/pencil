import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TagSuggestionsResponse } from "@/contracts/tags";
import { route } from "@/server/http/route";
import { suggestTags } from "@/server/posts/service";

const suggestQuery = z.object({ q: z.string().max(100, "Keep the search short.").default("") });

/**
 * GET /api/tags?q=: existing tags starting with `q`, most used first, for the
 * editor's autocomplete. Only tags on published posts are counted or offered.
 */
export const GET = route(async (request: NextRequest) => {
  const { q } = suggestQuery.parse({ q: request.nextUrl.searchParams.get("q") ?? undefined });
  const body: TagSuggestionsResponse = await suggestTags(q);
  return Response.json(body);
});
