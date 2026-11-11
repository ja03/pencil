import { describe, expect, it } from "vitest";
import { checkPostContent } from "./post-content";

const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks && { marks }) });
const doc = (...content: unknown[]) => ({ type: "doc", content });

function issueOf(value: unknown) {
  const result = checkPostContent(value);
  if (result.ok) throw new Error("expected the content to be rejected");
  return result.issue;
}

describe("checkPostContent", () => {
  it("accepts every whitelisted node and mark", () => {
    const content = doc(
      { type: "heading", attrs: { level: 2 }, content: [t("H2")] },
      { type: "heading", attrs: { level: 3 }, content: [t("H3")] },
      p(t("b", [{ type: "bold" }]), t("i", [{ type: "italic" }]), t("c", [{ type: "code" }]), { type: "hardBreak" }),
      p(t("link", [{ type: "link", attrs: { href: "mailto:a@pencil.example" } }])),
      { type: "bulletList", content: [{ type: "listItem", content: [p(t("x")), { type: "bulletList", content: [{ type: "listItem", content: [p(t("nested"))] }] }] }] },
      { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [p(t("y"))] }] },
      { type: "blockquote", content: [p(t("q"))] },
      { type: "codeBlock", attrs: { language: null }, content: [t("code")] },
      { type: "image", attrs: { src: "https://cdn.pencil.example/a.png", alt: null, title: null } },
    );

    const result = checkPostContent(content);

    expect(result).toEqual({ ok: true, content });
  });

  it("accepts a document holding only an image", () => {
    const result = checkPostContent(doc({ type: "image", attrs: { src: "https://a.example/a.png" } }));

    expect(result.ok).toBe(true);
  });

  it("fills in defaults and drops unknown attributes and keys", () => {
    const result = checkPostContent({
      type: "doc",
      extra: true,
      content: [
        { type: "orderedList", attrs: { type: "a", class: "x" }, content: [{ type: "listItem", content: [p(t("y"))] }] },
        { type: "paragraph", attrs: { textAlign: "center" } , content: [t("z")] },
        { type: "codeBlock", content: [t("c")] },
      ],
    });

    expect(result).toEqual({
      ok: true,
      content: doc(
        { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [p(t("y"))] }] },
        p(t("z")),
        { type: "codeBlock", attrs: { language: null }, content: [t("c")] },
      ),
    });
  });

  it.each([
    ["null", null],
    ["a string", "<p>hi</p>"],
    ["an array", [p(t("x"))]],
    ["a non-doc root", p(t("x"))],
  ])("rejects %s as the root", (_, value) => {
    expect(issueOf(value).message).toBe("Content must be a document.");
  });

  it.each([
    ["no blocks", doc()],
    ["empty paragraphs", doc({ type: "paragraph" }, p())],
    ["whitespace only", doc(p(t("  \n\t ")))],
    ["only a line break", doc(p({ type: "hardBreak" }))],
  ])("rejects a document with %s as empty", (_, value) => {
    expect(issueOf(value).message).toBe("Write something before saving.");
  });

  it.each([
    ["table", doc({ type: "table", content: [] })],
    ["horizontalRule", doc({ type: "horizontalRule" }, p(t("x")))],
    ["taskList", doc({ type: "taskList", content: [] })],
    ["mention", doc(p({ type: "mention", attrs: { id: "x" } }))],
    ["underline", doc(p(t("x", [{ type: "underline" }])))],
    ["strike", doc(p(t("x", [{ type: "strike" }])))],
    ["textStyle", doc(p(t("x", [{ type: "textStyle", attrs: { color: "red" } }])))],
  ])("rejects %s", (type, value) => {
    expect(issueOf(value).message).toBe(`Posts can't contain "${type}".`);
  });

  it("reports where the problem is", () => {
    const issue = issueOf(doc(p(t("ok")), { type: "blockquote", content: [p(t("x", [{ type: "strike" }]))] }));

    expect(issue.path).toEqual(["content", 1, "content", 0, "content", 0, "marks", 0]);
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["JaVaScRiPt: with spaces", " JaVaScRiPt:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["vbscript:", "vbscript:msgbox"],
    ["a relative URL", "/settings"],
    ["a missing href", undefined],
    ["a very long URL", `https://a.example/${"x".repeat(3000)}`],
  ])("rejects a link with %s", (_, href) => {
    const issue = issueOf(doc(p(t("x", [{ type: "link", attrs: { href } }]))));
    expect(issue.message).toBe("Links must use http, https or mailto.");
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:image/png;base64,AAAA"],
    ["a relative path", "/a.png"],
    ["no src", undefined],
  ])("rejects an image with %s", (_, src) => {
    expect(issueOf(doc({ type: "image", attrs: { src } })).message).toBe(
      "Images need an http(s) address.",
    );
  });

  describe("with an image base (Pencil's storage)", () => {
    const imageBase = "http://localhost:9000/pencil";
    const image = (src: string) => doc({ type: "image", attrs: { src } });
    const check = (src: string) => checkPostContent(image(src), { imageBase });

    it.each([
      ["a stored image", `${imageBase}/images/u/a.png`],
      ["a stored image when the base has a trailing slash", `${imageBase}/images/b.webp`],
    ])("accepts %s", (_, src) => {
      expect(check(src).ok).toBe(true);
      expect(checkPostContent(image(src), { imageBase: `${imageBase}/` }).ok).toBe(true);
    });

    it.each([
      ["another site", "https://tracker.example/pixel.gif"],
      ["the same host on another port", "http://localhost:9001/pencil/a.png"],
      ["another bucket sharing the prefix", "http://localhost:9000/pencil-evil/a.png"],
      ["the bucket root itself", `${imageBase}/`],
      ["a path that climbs out of the bucket", `${imageBase}/../other/a.png`],
      ["an encoded climb out of the bucket", `${imageBase}/%2e%2e/other/a.png`],
      ["a backslash climb out of the bucket", `${imageBase}/..\\other/a.png`],
      ["credentials in the address", "http://localhost:9000@tracker.example/pencil/a.png"],
    ])("rejects an image from %s", (_, src) => {
      const result = check(src);
      if (result.ok) throw new Error("expected the content to be rejected");
      expect(result.issue).toEqual({
        path: ["content", 0, "attrs", "src"],
        message: "Images must be uploaded to Pencil.",
      });
    });

    it("rejects an external image nested inside a list", () => {
      const result = checkPostContent(
        doc({
          type: "bulletList",
          content: [{ type: "listItem", content: [p(t("x")), { type: "image", attrs: { src: "https://a.example/a.png" } }] }],
        }),
        { imageBase },
      );
      expect(result.ok).toBe(false);
    });

    it("still rejects addresses that aren't http(s)", () => {
      const result = check("javascript:alert(1)");
      expect(result.ok || result.issue.message).toBe("Images need an http(s) address.");
    });
  });

  it.each([1, 4, "2", null])("rejects heading level %j", (level) => {
    expect(issueOf(doc({ type: "heading", attrs: { level }, content: [t("x")] })).message).toBe(
      "Headings must be level 2 or 3.",
    );
  });

  it("rejects a code block language that isn't a plain name", () => {
    const issue = issueOf(doc({ type: "codeBlock", attrs: { language: '"><script>' }, content: [t("x")] }));
    expect(issue.message).toBe("That code language isn't valid.");
  });

  it("rejects formatting inside a code block", () => {
    const issue = issueOf(doc({ type: "codeBlock", content: [t("x", [{ type: "bold" }])] }));
    expect(issue.message).toBe("Code blocks can't be formatted.");
  });

  it.each([
    ["an empty list", doc({ type: "bulletList", content: [] })],
    ["an empty quote", doc({ type: "blockquote", content: [] }, p(t("x")))],
    ["an empty list item", doc({ type: "bulletList", content: [{ type: "listItem", content: [] }] })],
  ])("rejects %s", (_, value) => {
    expect(issueOf(value).message).toBe("This block can't be empty.");
  });

  it.each([
    ["a node without a type", doc({ content: [] })],
    ["text without text", doc(p({ type: "text", text: "" }))],
    ["content that isn't a list", doc({ type: "paragraph", content: "x" })],
  ])("rejects %s", (_, value) => {
    expect(checkPostContent(value).ok).toBe(false);
  });

  it("rejects content nested too deeply", () => {
    let node: unknown = p(t("deep"));
    for (let i = 0; i < 25; i++) node = { type: "blockquote", content: [node] };

    expect(issueOf(doc(node)).message).toBe("Content is nested too deeply.");
  });

  it("rejects documents with too many nodes", () => {
    const many = Array.from({ length: 20_001 }, () => p(t("x")));
    expect(issueOf(doc(...many)).message).toBe("Content is too long.");
  });
});
