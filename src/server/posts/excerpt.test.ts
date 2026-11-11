import { describe, expect, it } from "vitest";
import type { PostContent } from "@/contracts/post-content";
import { excerptOf } from "./excerpt";

const doc = (...texts: string[]): PostContent => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

describe("excerptOf", () => {
  it("returns short content whole, with blocks joined by spaces", () => {
    expect(excerptOf(doc("First.", "Second."))).toBe("First. Second.");
  });

  it("collapses whitespace", () => {
    expect(excerptOf(doc("  lots   of\n\nspace  "))).toBe("lots of space");
  });

  it("cuts long content at a word boundary with an ellipsis", () => {
    const text = "alpha beta gamma delta ".repeat(20);

    const excerpt = excerptOf(doc(text));

    expect(excerpt.length).toBeLessThanOrEqual(161);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(text.startsWith(excerpt.slice(0, -1))).toBe(true);
    expect(excerpt.slice(0, -1)).toMatch(/(alpha|beta|gamma|delta)$/);
  });

  it("cuts a single very long word at 160 characters", () => {
    expect(excerptOf(doc("x".repeat(500)))).toBe(`${"x".repeat(160)}…`);
  });

  it("reads text inside lists, quotes and headings", () => {
    const content: PostContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: doc("one").content }],
        },
        { type: "blockquote", content: doc("quoted").content },
      ],
    };

    expect(excerptOf(content)).toBe("Title one quoted");
  });
});
