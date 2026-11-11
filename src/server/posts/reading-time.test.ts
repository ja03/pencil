import { describe, expect, it } from "vitest";
import type { PostContent } from "@/contracts/post-content";
import { readingMinutesOf, WORDS_PER_MINUTE } from "./reading-time";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

const doc = (...texts: string[]): PostContent => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

describe("readingMinutesOf", () => {
  it("is at least one minute, even for a single word", () => {
    expect(readingMinutesOf(doc("Hello"))).toBe(1);
  });

  it("is one minute for exactly a minute's worth of words", () => {
    expect(readingMinutesOf(doc(words(WORDS_PER_MINUTE)))).toBe(1);
  });

  it("rounds up a partial minute", () => {
    expect(readingMinutesOf(doc(words(WORDS_PER_MINUTE + 1)))).toBe(2);
  });

  it("counts words across every block", () => {
    const half = words(WORDS_PER_MINUTE * 2);

    expect(readingMinutesOf(doc(half, half))).toBe(4);
  });

  it("ignores extra whitespace between words", () => {
    const spaced = Array.from({ length: WORDS_PER_MINUTE * 3 }, () => "w").join("   \n ");

    expect(readingMinutesOf(doc(spaced))).toBe(3);
  });

  it("counts words inside lists, quotes and code", () => {
    const content: PostContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [{ type: "listItem", content: doc(words(WORDS_PER_MINUTE)).content }],
        },
        { type: "blockquote", content: doc(words(WORDS_PER_MINUTE)).content },
        {
          type: "codeBlock",
          attrs: { language: null },
          content: [{ type: "text", text: words(WORDS_PER_MINUTE) }],
        },
      ],
    };

    expect(readingMinutesOf(content)).toBe(3);
  });
});
