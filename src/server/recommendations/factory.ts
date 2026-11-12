import type { EmbeddingProvider } from "@/server/embeddings/provider";
import { EmbeddingStrategy } from "./embedding";
import type { RecommendationStrategy } from "./strategy";
import { TagOverlapStrategy } from "./tag-overlap";

/**
 * Picks how recommendations are made (Factory pattern). With an embedding
 * provider (the Gemini key is set), by meaning; without one, by tag overlap.
 */
export function createRecommendationStrategy(
  provider: EmbeddingProvider | null,
): RecommendationStrategy {
  return provider ? new EmbeddingStrategy() : new TagOverlapStrategy();
}
