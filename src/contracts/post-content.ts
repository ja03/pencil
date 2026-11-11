// Post content is Tiptap JSON. This module is the whitelist: it accepts only
// the node and mark types Pencil supports, rebuilds the document with only
// the attributes it knows (dropping everything else), and rejects anything
// it doesn't recognise. The server runs it on every save, so content sent
// straight to the API is held to the same rules as the editor's.
// Pure and shared: the editor runs the same check before saving.

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "code" }
  | { type: "link"; attrs: { href: string } };

export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type HardBreakNode = { type: "hardBreak" };
export type InlineNode = TextNode | HardBreakNode;

export type ParagraphNode = { type: "paragraph"; content?: InlineNode[] };
export type HeadingNode = {
  type: "heading";
  attrs: { level: HeadingLevel };
  content?: InlineNode[];
};
export type ListItemNode = { type: "listItem"; content: BlockNode[] };
export type BulletListNode = { type: "bulletList"; content: ListItemNode[] };
export type OrderedListNode = {
  type: "orderedList";
  attrs: { start: number };
  content: ListItemNode[];
};
export type BlockquoteNode = { type: "blockquote"; content: BlockNode[] };
export type CodeBlockNode = {
  type: "codeBlock";
  attrs: { language: string | null };
  content?: { type: "text"; text: string }[];
};
export type ImageNode = {
  type: "image";
  attrs: { src: string; alt: string | null; title: string | null };
};

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | BulletListNode
  | OrderedListNode
  | BlockquoteNode
  | CodeBlockNode
  | ImageNode;

export type PostContent = { type: "doc"; content: BlockNode[] };

/** H1 is the post title, so the body starts at H2. */
export const HEADING_LEVELS = [2, 3] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

// Limits that keep a hostile document from costing much to check or render.
const MAX_DEPTH = 20;
const MAX_NODES = 20_000;
const MAX_TEXT_LENGTH = 200_000;
const MAX_URL_LENGTH = 2048;
const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const IMAGE_PROTOCOLS = new Set(["http:", "https:"]);
const LANGUAGE_PATTERN = /^[a-z0-9+#.-]{1,30}$/i;

export type ContentIssue = { path: (string | number)[]; message: string };
export type ContentResult =
  | { ok: true; content: PostContent }
  | { ok: false; issue: ContentIssue };

class Invalid extends Error {
  constructor(
    readonly path: (string | number)[],
    message: string,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when `value` parses as an absolute URL with one of `protocols`. */
export function isAllowedUrl(value: unknown, protocols: Set<string>): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) {
    return false;
  }
  try {
    return protocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function isAllowedLinkHref(value: unknown): value is string {
  return isAllowedUrl(value, LINK_PROTOCOLS);
}

export function isAllowedImageSrc(value: unknown): value is string {
  return isAllowedUrl(value, IMAGE_PROTOCOLS);
}

/**
 * True when `src` is an address inside `base` (Pencil's storage). Both the
 * address as written and as a browser would resolve it must sit under the
 * base, so `..` segments (plain, encoded or with backslashes) can't climb out.
 */
export function isUnderImageBase(src: string, base: string): boolean {
  try {
    const prefix = new URL(base).href.replace(/\/*$/, "/");
    return (
      src.startsWith(prefix) && src.length > prefix.length && new URL(src).href.startsWith(prefix)
    );
  } catch {
    return false;
  }
}

/** Rules for images, set by whoever checks: the server knows where its storage is. */
export type ImageRules = {
  /**
   * Public base address of Pencil's storage. When set, every image must sit
   * under it, so posts can't embed tracking pixels from other sites.
   */
  imageBase?: string;
};

/** Why `src` can't be an image address, or null when it can. */
export function imageSrcProblem(src: unknown, { imageBase }: ImageRules = {}): string | null {
  if (!isAllowedImageSrc(src)) return "Images need an http(s) address.";
  if (imageBase !== undefined && !isUnderImageBase(src, imageBase)) {
    return "Images must be uploaded to Pencil.";
  }
  return null;
}

class Checker {
  constructor(private readonly rules: ImageRules) {}

  private nodes = 0;
  private textLength = 0;
  /** Whether the document has any visible text or an image. */
  hasSubstance = false;

  doc(value: unknown): PostContent {
    if (!isObject(value) || value.type !== "doc") {
      throw new Invalid([], "Content must be a document.");
    }
    return { type: "doc", content: this.children(value, [], 1, (n, p, d) => this.block(n, p, d)) };
  }

  private count(path: (string | number)[], depth: number) {
    if (depth > MAX_DEPTH) throw new Invalid(path, "Content is nested too deeply.");
    if (++this.nodes > MAX_NODES) throw new Invalid(path, "Content is too long.");
  }

  private children<T>(
    node: Json,
    path: (string | number)[],
    depth: number,
    each: (child: unknown, path: (string | number)[], depth: number) => T,
    { required = false } = {},
  ): T[] {
    const content = node.content;
    if (content === undefined) {
      if (required) throw new Invalid([...path, "content"], "This block can't be empty.");
      return [];
    }
    if (!Array.isArray(content)) {
      throw new Invalid([...path, "content"], "Content must be a list.");
    }
    if (required && content.length === 0) {
      throw new Invalid([...path, "content"], "This block can't be empty.");
    }
    return content.map((child, i) => each(child, [...path, "content", i], depth + 1));
  }

  private typeOf(node: unknown, path: (string | number)[]): { node: Json; type: string } {
    if (!isObject(node) || typeof node.type !== "string") {
      throw new Invalid(path, "Every node needs a type.");
    }
    return { node, type: node.type };
  }

  private unsupported(type: string, path: (string | number)[]): never {
    throw new Invalid(path, `Posts can't contain "${type.slice(0, 40)}".`);
  }

  private block(value: unknown, path: (string | number)[], depth: number): BlockNode {
    this.count(path, depth);
    const { node, type } = this.typeOf(value, path);
    const attrs = isObject(node.attrs) ? node.attrs : {};
    const inline = () => this.children(node, path, depth, (n, p, d) => this.inline(n, p, d));
    const blocks = () =>
      this.children(node, path, depth, (n, p, d) => this.block(n, p, d), { required: true });
    const items = () =>
      this.children(node, path, depth, (n, p, d) => this.listItem(n, p, d), { required: true });

    switch (type) {
      case "paragraph":
        return withContent({ type }, inline());
      case "heading": {
        const level = attrs.level;
        if (!HEADING_LEVELS.includes(level as HeadingLevel)) {
          throw new Invalid([...path, "attrs", "level"], "Headings must be level 2 or 3.");
        }
        return withContent({ type, attrs: { level: level as HeadingLevel } }, inline());
      }
      case "bulletList":
        return { type, content: items() };
      case "orderedList": {
        const start = attrs.start ?? 1;
        if (!Number.isSafeInteger(start) || (start as number) < 0) {
          throw new Invalid([...path, "attrs", "start"], "A list must start at a whole number.");
        }
        return { type, attrs: { start: start as number }, content: items() };
      }
      case "blockquote":
        return { type, content: blocks() };
      case "codeBlock": {
        const language = attrs.language ?? null;
        if (language !== null && !(typeof language === "string" && LANGUAGE_PATTERN.test(language))) {
          throw new Invalid([...path, "attrs", "language"], "That code language isn't valid.");
        }
        const content = this.children(node, path, depth, (n, p, d) => this.plainText(n, p, d));
        return withContent({ type, attrs: { language } }, content);
      }
      case "image": {
        const problem = imageSrcProblem(attrs.src, this.rules);
        if (problem) throw new Invalid([...path, "attrs", "src"], problem);
        this.hasSubstance = true;
        return {
          type,
          attrs: { src: attrs.src as string, alt: optionalString(attrs.alt), title: optionalString(attrs.title) },
        };
      }
      default:
        return this.unsupported(type, path);
    }
  }

  private listItem(value: unknown, path: (string | number)[], depth: number): ListItemNode {
    this.count(path, depth);
    const { node, type } = this.typeOf(value, path);
    if (type !== "listItem") throw new Invalid(path, "Lists can only hold list items.");
    return {
      type,
      content: this.children(node, path, depth, (n, p, d) => this.block(n, p, d), {
        required: true,
      }),
    };
  }

  private inline(value: unknown, path: (string | number)[], depth: number): InlineNode {
    this.count(path, depth);
    const { node, type } = this.typeOf(value, path);
    if (type === "hardBreak") return { type };
    if (type !== "text") return this.unsupported(type, path);
    const text = this.text(node, path);
    if (node.marks === undefined) return { type, text };
    if (!Array.isArray(node.marks)) throw new Invalid([...path, "marks"], "Marks must be a list.");
    const marks = node.marks.map((m, i) => this.mark(m, [...path, "marks", i]));
    return marks.length > 0 ? { type, text, marks } : { type, text };
  }

  private plainText(
    value: unknown,
    path: (string | number)[],
    depth: number,
  ): { type: "text"; text: string } {
    this.count(path, depth);
    const { node, type } = this.typeOf(value, path);
    if (type !== "text") throw new Invalid(path, "Code blocks can only hold text.");
    if (node.marks !== undefined && !(Array.isArray(node.marks) && node.marks.length === 0)) {
      throw new Invalid([...path, "marks"], "Code blocks can't be formatted.");
    }
    return { type: "text", text: this.text(node, path) };
  }

  private text(node: Json, path: (string | number)[]): string {
    const text = node.text;
    if (typeof text !== "string" || text.length === 0) {
      throw new Invalid([...path, "text"], "Text nodes need text.");
    }
    this.textLength += text.length;
    if (this.textLength > MAX_TEXT_LENGTH) throw new Invalid(path, "Content is too long.");
    if (text.trim().length > 0) this.hasSubstance = true;
    return text;
  }

  private mark(value: unknown, path: (string | number)[]): Mark {
    const { node, type } = this.typeOf(value, path);
    switch (type) {
      case "bold":
      case "italic":
      case "code":
        return { type };
      case "link": {
        const href = isObject(node.attrs) ? node.attrs.href : undefined;
        if (!isAllowedLinkHref(href)) {
          throw new Invalid([...path, "attrs", "href"], "Links must use http, https or mailto.");
        }
        return { type, attrs: { href } };
      }
      default:
        return this.unsupported(type, path);
    }
  }
}

function withContent<T extends object, C>(node: T, content: C[]): T & { content?: C[] } {
  return content.length > 0 ? { ...node, content } : node;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 500) : null;
}

/**
 * Checks Tiptap JSON against the whitelist. On success, returns a rebuilt
 * copy holding only known types and attributes. Empty documents (no text
 * and no images) are rejected. With `rules.imageBase`, images from anywhere
 * else are rejected too.
 */
export function checkPostContent(value: unknown, rules: ImageRules = {}): ContentResult {
  const checker = new Checker(rules);
  try {
    const content = checker.doc(value);
    if (!checker.hasSubstance) {
      return { ok: false, issue: { path: [], message: "Write something before saving." } };
    }
    return { ok: true, content };
  } catch (error) {
    if (error instanceof Invalid) {
      return { ok: false, issue: { path: error.path, message: error.message } };
    }
    throw error;
  }
}

/** The document's text, block by block, with whitespace collapsed. */
export function plainTextOf(content: PostContent): string {
  const parts: string[] = [];
  const walk = (node: BlockNode | ListItemNode | InlineNode | { type: "text"; text: string }) => {
    if (node.type === "text") parts.push(node.text);
    else if (node.type === "hardBreak") parts.push(" ");
    else if ("content" in node && node.content) {
      for (const child of node.content) walk(child);
      parts.push(" ");
    }
  };
  for (const block of content.content) walk(block);
  return parts.join("").replace(/\s+/g, " ").trim();
}
