/** Something recommendations are picked for or from; only its id matters here. */
export type Ref = { id: string };

/**
 * One way of picking related posts (Strategy pattern). Each returns post ids,
 * best match first, and applies the same exclusions: never drafts, deleted
 * posts, the viewer's own posts or posts the viewer already liked. Either may
 * return fewer than asked for, or none, when it has nothing to go on; the
 * recommendation service tops the list up with popular posts.
 */
export interface RecommendationStrategy {
  /** Up to `take` posts `user` hasn't seen, picked from the posts they liked. */
  recommendForUser(user: Ref, take: number): Promise<string[]>;
  /** Up to `take` posts like `post`, for `viewer` (null when logged out). Never `post` itself. */
  similarTo(post: Ref, viewer: Ref | null, take: number): Promise<string[]>;
}
