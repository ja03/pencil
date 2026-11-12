import { describe, expect, it } from "vitest";
import { providerForKey } from "@/server/embeddings/provider";
import { EmbeddingStrategy } from "./embedding";
import { createRecommendationStrategy } from "./factory";
import { TagOverlapStrategy } from "./tag-overlap";

describe("createRecommendationStrategy", () => {
  it("picks the embedding strategy when the AI key is set", () => {
    expect(createRecommendationStrategy(providerForKey("a-gemini-key"))).toBeInstanceOf(
      EmbeddingStrategy,
    );
  });

  it("picks tag overlap when no AI key is set", () => {
    expect(createRecommendationStrategy(providerForKey(undefined))).toBeInstanceOf(
      TagOverlapStrategy,
    );
    expect(createRecommendationStrategy(providerForKey(""))).toBeInstanceOf(TagOverlapStrategy);
  });
});
