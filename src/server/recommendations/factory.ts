import type { RecommendationStrategy } from "./strategy";
import { TagOverlapStrategy } from "./tag-overlap";

export type StrategySettings = {
  /** The Gemini API key, when one is configured. */
  aiKey?: string;
};

/**
 * Picks how recommendations are made (Factory pattern). Without an AI key,
 * tag overlap. The embedding strategy (#21) takes the keyed case; until it
 * lands, a key changes nothing.
 */
export function createRecommendationStrategy({ aiKey }: StrategySettings): RecommendationStrategy {
  if (!aiKey) return new TagOverlapStrategy();
  return new TagOverlapStrategy();
}
