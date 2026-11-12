// Shared by the API and the client: recommendation response shapes.
import type { PostSummary } from "./posts";

/** Posts in the feed's "Recommended for you" row. */
export const RECOMMENDED_FOR_YOU_COUNT = 5;

/** Posts in a post page's "More like this". */
export const MORE_LIKE_THIS_COUNT = 3;

/** How many days back the popular fallback looks for posts. */
export const POPULAR_WINDOW_DAYS = 30;

/**
 * What the list was picked from:
 * - `liked`: posts like the ones the reader liked ("Recommended for you").
 * - `similar`: posts like the one being read ("More like this").
 * - `popular`: nothing to go on (logged out, no likes, no related posts), so
 *   the most-liked posts of the last 30 days.
 *
 * `liked` and `similar` lists may end with popular posts when too few match.
 */
export type RecommendationBasis = "liked" | "similar" | "popular";

/** Body of `GET /api/recommendations` and `GET /api/posts/:id/similar`. Best match first. */
export type RecommendationsResponse = { posts: PostSummary[]; basis: RecommendationBasis };
