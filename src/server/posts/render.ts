import {
  isAllowedImageSrc,
  isAllowedLinkHref,
  type BlockNode,
  type InlineNode,
  type ListItemNode,
  type Mark,
  type PostContent,
} from "@/contracts/post-content";

// Turns whitelisted Tiptap JSON into HTML. Output is built only from the
// fixed tags below; every piece of user text and every attribute value is
// escaped, so nothing in a post can open a tag, add an attribute or run a
// script. URLs are re-checked here even though the validator already did.

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const LINK_REL = "noopener noreferrer nofollow ugc";

function renderMarks(text: string, marks: Mark[] = []): string {
  let html = escapeHtml(text);
  // A fixed nesting order, so the same marks always produce the same HTML.
  const has = (type: Mark["type"]) => marks.some((m) => m.type === type);
  if (has("code")) html = `<code>${html}</code>`;
  if (has("italic")) html = `<em>${html}</em>`;
  if (has("bold")) html = `<strong>${html}</strong>`;
  const link = marks.find((m) => m.type === "link");
  if (link && isAllowedLinkHref(link.attrs.href)) {
    html = `<a href="${escapeHtml(link.attrs.href)}" rel="${LINK_REL}" target="_blank">${html}</a>`;
  }
  return html;
}

function renderInline(nodes: InlineNode[] = []): string {
  return nodes
    .map((node) => (node.type === "hardBreak" ? "<br>" : renderMarks(node.text, node.marks)))
    .join("");
}

function renderBlocks(nodes: (BlockNode | ListItemNode)[]): string {
  return nodes.map(renderBlock).join("");
}

function renderBlock(node: BlockNode | ListItemNode): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${renderInline(node.content)}</p>`;
    case "heading":
      return `<h${node.attrs.level}>${renderInline(node.content)}</h${node.attrs.level}>`;
    case "bulletList":
      return `<ul>${renderBlocks(node.content)}</ul>`;
    case "orderedList": {
      const start = node.attrs.start === 1 ? "" : ` start="${Math.trunc(node.attrs.start)}"`;
      return `<ol${start}>${renderBlocks(node.content)}</ol>`;
    }
    case "listItem":
      return `<li>${renderBlocks(node.content)}</li>`;
    case "blockquote":
      return `<blockquote>${renderBlocks(node.content)}</blockquote>`;
    case "codeBlock": {
      const lang = node.attrs.language
        ? ` class="language-${escapeHtml(node.attrs.language)}"`
        : "";
      const code = (node.content ?? []).map((t) => escapeHtml(t.text)).join("");
      return `<pre><code${lang}>${code}</code></pre>`;
    }
    case "image": {
      const { src, alt, title } = node.attrs;
      if (!isAllowedImageSrc(src)) return "";
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt ?? "")}"${titleAttr} loading="lazy">`;
    }
  }
}

/** Sanitized HTML for a validated post body. */
export function renderPostContent(content: PostContent): string {
  return renderBlocks(content.content);
}
