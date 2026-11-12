import { describe, expect, it } from "vitest";
import { changesEmbedding, embeddingTextOf } from "./text";

describe("embeddingTextOf", () => {
  it("joins the title, description and tags", () => {
    expect(
      embeddingTextOf({
        title: "Baking sourdough",
        description: "A starter, flour and patience.",
        tags: ["baking", "bread"],
      }),
    ).toBe("Baking sourdough\nA starter, flour and patience.\n#baking #bread");
  });

  it("leaves out a missing description and an empty tag list", () => {
    expect(embeddingTextOf({ title: "Just a title", description: null, tags: [] })).toBe(
      "Just a title",
    );
  });
});

describe("changesEmbedding", () => {
  const post = { title: "Title", description: "About it", tags: ["one", "two"] };

  it("is false when the title, description and tags stay the same", () => {
    expect(changesEmbedding(post, { ...post })).toBe(false);
  });

  it("is true when the title, description or tags change, tag order included", () => {
    expect(changesEmbedding(post, { ...post, title: "New title" })).toBe(true);
    expect(changesEmbedding(post, { ...post, description: null })).toBe(true);
    expect(changesEmbedding(post, { ...post, tags: ["one"] })).toBe(true);
    expect(changesEmbedding(post, { ...post, tags: ["two", "one"] })).toBe(true);
  });
});
