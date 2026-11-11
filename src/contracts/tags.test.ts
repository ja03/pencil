import { describe, expect, it } from "vitest";
import { MAX_TAG_LENGTH, normalizeTag, postTags } from "./tags";

describe("normalizeTag", () => {
  it.each([
    ["react", "react"],
    ["React", "react"],
    ["REACT", "react"],
    ["  react  ", "react"],
    ["#react", "react"],
    ["##React", "react"],
    ["Machine Learning", "machine-learning"],
    ["machine   learning", "machine-learning"],
    ["snake_case", "snake-case"],
    ["writing-life", "writing-life"],
    ["Web3", "web3"],
    ["Café", "café"],
    ["ÉCRITURE", "écriture"],
    ["مدونة", "مدونة"],
  ])("%j → %j", (raw, tag) => {
    expect(normalizeTag(raw)).toBe(tag);
  });

  it("maps differently-cased input to one tag", () => {
    const variants = ["React", "react", "REACT", "rEaCt", " #React "];

    expect(new Set(variants.map(normalizeTag))).toEqual(new Set(["react"]));
  });

  it.each([[""], ["   "], ["#"], ["c++"], ["next.js"], ["a/b"], ["-"], ["<script>"]])(
    "rejects %j",
    (raw) => {
      expect(normalizeTag(raw)).toBeNull();
    },
  );

  it(`allows up to ${MAX_TAG_LENGTH} characters`, () => {
    expect(normalizeTag("a".repeat(MAX_TAG_LENGTH))).toBe("a".repeat(MAX_TAG_LENGTH));
    expect(normalizeTag("a".repeat(MAX_TAG_LENGTH + 1))).toBeNull();
  });
});

describe("postTags", () => {
  it("normalizes each tag and keeps the author's order", () => {
    expect(postTags.parse(["Writing", "craft", "Habits"])).toEqual(["writing", "craft", "habits"]);
  });

  it("drops repeats that normalize to the same tag", () => {
    expect(postTags.parse(["React", "react", "#REACT", "redux"])).toEqual(["react", "redux"]);
  });

  it("allows five tags", () => {
    expect(postTags.parse(["a", "b", "c", "d", "e"])).toHaveLength(5);
  });

  it("rejects a sixth distinct tag", () => {
    const result = postTags.safeParse(["a", "b", "c", "d", "e", "f"]);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual(["Use up to 5 tags."]);
  });

  it("counts tags after repeats are dropped", () => {
    expect(postTags.parse(["a", "A", "b", "c", "d", "e"])).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("rejects a tag it can't normalize, naming it", () => {
    const result = postTags.safeParse(["react", "c++"]);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "“c++” isn't a valid tag. Use letters, numbers and hyphens.",
    );
  });

  it("rejects anything that isn't a list of strings", () => {
    expect(postTags.safeParse("react").success).toBe(false);
    expect(postTags.safeParse([1, 2]).success).toBe(false);
  });
});
