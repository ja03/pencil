import type { CurrentUser } from "@/contracts/auth";
import {
  MORE_LIKE_THIS_COUNT,
  POPULAR_WINDOW_DAYS,
  RECOMMENDED_FOR_YOU_COUNT,
  type RecommendationBasis,
  type RecommendationsResponse,
} from "@/contracts/recommendations";
import { clock } from "@/server/clock";
import { embeddingProvider } from "@/server/embeddings/provider";
import { ApiError } from "@/server/http/errors";
import { isPublished } from "@/server/posts/repository";
import { summariesOf } from "@/server/posts/service";
import { createRecommendationStrategy } from "./factory";
import { findPopularSince } from "./repository";

const DAY_MS = 24 * 60 * 60 * 1000;

function strategy() {
  return createRecommendationStrategy(embeddingProvider());
}

/**
 * Turns the strategy's picks into cards, topping the list up to `take` with
 * the most-liked posts of the last 30 days. With no picks at all, the list
 * is the popular fallback and says so.
 */
async function present(
  viewer: CurrentUser | null,
  picks: string[],
  take: number,
  basis: Exclude<RecommendationBasis, "popular">,
  skip: string[] = [],
): Promise<RecommendationsResponse> {
  const since = new Date(clock.now().getTime() - POPULAR_WINDOW_DAYS * DAY_MS);
  const popular =
    picks.length < take
      ? await findPopularSince(
          since,
          { viewerId: viewer?.id ?? null, skip: [...skip, ...picks] },
          take - picks.length,
        )
      : [];
  return {
    posts: await summariesOf(viewer, [...picks, ...popular]),
    basis: picks.length > 0 ? basis : "popular",
  };
}

/**
 * The feed's "Recommended for you": 5 posts picked from what `viewer` liked.
 * Logged out, or with nothing liked yet, the most-liked posts of the last 30
 * days.
 */
export async function recommendFor(viewer: CurrentUser | null): Promise<RecommendationsResponse> {
  const take = RECOMMENDED_FOR_YOU_COUNT;
  const picks = viewer ? await strategy().recommendForUser(viewer, take) : [];
  return present(viewer, picks, take, "liked");
}

/**
 * A post's "More like this": 3 posts related to it, readable logged out. Only
 * published posts have any; a draft is 404 to everyone, like an unknown post.
 */
export async function similarTo(
  viewer: CurrentUser | null,
  postId: string,
): Promise<RecommendationsResponse> {
  if (!(await isPublished(postId))) throw new ApiError("NOT_FOUND", "That post doesn't exist.");
  const take = MORE_LIKE_THIS_COUNT;
  const picks = await strategy().similarTo({ id: postId }, viewer, take);
  return present(viewer, picks, take, "similar", [postId]);
}
