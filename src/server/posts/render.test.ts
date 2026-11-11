import { describe, expect, it } from "vitest";
import type { BlockNode, PostContent } from "@/contracts/post-content";
import { renderPostContent } from "./render";

const render = (...content: BlockNode[]) => renderPostContent({ type: "doc", content } as PostContent);
const text = (t: string, marks?: never[]) => ({ type: "text" as const, text: t, ...(marks && { marks }) });

describe("renderPostContent", () => {
  it("renders every whitelisted block", () => {
    const html = render(
      { type: "heading", attrs: { level: 2 }, content: [text("Heading")] },
      { type: "paragraph", content: [text("a"), { type: "hardBreak" }, text("b")] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("x")] }] }] },
      { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("y")] }] }] },
      { type: "blockquote", content: [{ type: "paragraph", content: [text("q")] }] },
      { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "let a = 1;" }] },
      { type: "image", attrs: { src: "https://cdn.pencil.example/a.png", alt: "A", title: null } },
    );

    expect(html).toBe(
      "<h2>Heading</h2><p>a<br>b</p><ul><li><p>x</p></li></ul>" +
        '<ol start="3"><li><p>y</p></li></ol><blockquote><p>q</p></blockquote>' +
        '<pre><code class="language-ts">let a = 1;</code></pre>' +
        '<img src="https://cdn.pencil.example/a.png" alt="A" loading="lazy">',
    );
  });

  it("nests marks in a fixed order", () => {
    const html = render({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "x",
          marks: [{ type: "link", attrs: { href: "https://a.example" } }, { type: "code" }, { type: "bold" }, { type: "italic" }],
        },
      ],
    });

    expect(html).toBe(
      '<p><a href="https://a.example" rel="noopener noreferrer nofollow ugc" target="_blank">' +
        "<strong><em><code>x</code></em></strong></a></p>",
    );
  });

  it("escapes text so it can't open a tag", () => {
    expect(render({ type: "paragraph", content: [text(`<script>alert('x')</script> & "q"`)] })).toBe(
      "<p>&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;q&quot;</p>",
    );
  });

  it("escapes attribute values so they can't break out of the attribute", () => {
    const html = render({
      type: "image",
      attrs: { src: 'https://a.example/x.png"onerror="alert(1)', alt: '"><script>', title: "t'" },
    });

    expect(html).toBe(
      '<img src="https://a.example/x.png&quot;onerror=&quot;alert(1)" alt="&quot;&gt;&lt;script&gt;" title="t&#39;" loading="lazy">',
    );
  });

  it("drops a link or image whose URL isn't allowed, even if it got past validation", () => {
    const html = render(
      { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
      { type: "image", attrs: { src: "data:image/png;base64,AA", alt: null, title: null } },
    );

    expect(html).toBe("<p>x</p>");
  });
});
