import { findByLikedTags, findBySharedTags } from "./repository";
import type { RecommendationStrategy, Ref } from "./strategy";

/**
 * Recommends by shared tags, with no AI involved: the fallback whenever no
 * AI key is set. Ties go to the more-liked post, then the newer one.
 */
export class TagOverlapStrategy implements RecommendationStrategy {
  recommendForUser(user: Ref, take: number): Promise<string[]> {
    return findByLikedTags(user.id, { viewerId: user.id, skip: [] }, take);
  }

  similarTo(post: Ref, viewer: Ref | null, take: number): Promise<string[]> {
    return findBySharedTags(post.id, { viewerId: viewer?.id ?? null, skip: [post.id] }, take);
  }
}
