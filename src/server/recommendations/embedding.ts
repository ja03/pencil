import { findEmbedding, findLikedEmbeddings } from "@/server/embeddings/repository";
import { average } from "@/server/embeddings/vector";
import { findNearest } from "./repository";
import type { RecommendationStrategy, Ref } from "./strategy";
import { TagOverlapStrategy } from "./tag-overlap";

/**
 * Recommends by meaning: nearest neighbours of post embeddings, used when AI
 * is configured. A reader's taste is the average of the posts they liked.
 * Until there is a vector to go on (the post, or every post the reader liked,
 * is still waiting to be embedded), it falls back to tag overlap.
 */
export class EmbeddingStrategy implements RecommendationStrategy {
  private readonly fallback = new TagOverlapStrategy();

  async recommendForUser(user: Ref, take: number): Promise<string[]> {
    const liked = await findLikedEmbeddings(user.id);
    if (liked.length === 0) return this.fallback.recommendForUser(user, take);
    return findNearest(average(liked), { viewerId: user.id, skip: [] }, take);
  }

  async similarTo(post: Ref, viewer: Ref | null, take: number): Promise<string[]> {
    const vector = await findEmbedding(post.id);
    if (!vector) return this.fallback.similarTo(post, viewer, take);
    return findNearest(vector, { viewerId: viewer?.id ?? null, skip: [post.id] }, take);
  }
}
