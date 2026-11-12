import type { NextRequest } from "next/server";
import type { RecommendationsResponse } from "@/contracts/recommendations";
import { getCurrentUser } from "@/server/auth/service";
import { route } from "@/server/http/route";
import { recommendFor } from "@/server/recommendations/service";

/**
 * GET /api/recommendations: "Recommended for you", 5 posts picked from what
 * you liked. Logged out, or before your first like, the most-liked posts of
 * the last 30 days.
 */
export const GET = route(async (request: NextRequest) => {
  const body: RecommendationsResponse = await recommendFor(await getCurrentUser(request.cookies));
  return Response.json(body);
});
