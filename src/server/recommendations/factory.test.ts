import { describe, expect, it } from "vitest";
import { createRecommendationStrategy } from "./factory";
import { TagOverlapStrategy } from "./tag-overlap";

describe("createRecommendationStrategy", () => {
  it("picks tag overlap when no AI key is set", () => {
    expect(createRecommendationStrategy({})).toBeInstanceOf(TagOverlapStrategy);
    expect(createRecommendationStrategy({ aiKey: undefined })).toBeInstanceOf(TagOverlapStrategy);
  });
});
