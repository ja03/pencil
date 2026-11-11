import { describe, expect, it } from "vitest";
import { GET as getPost, PATCH as patchPost } from "@/app/api/posts/[id]/route";
import { POST as createPost } from "@/app/api/posts/route";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { call } from "../helpers/request";

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const doc = (...content: unknown[]) => ({ type: "doc", content });

const draft = {
  title: "Notes toward an essay on walking",
  description: "Why the morning loop matters.",
  content: doc(paragraph("I walk the same loop most mornings.")),
};

type Headers = Record<string, string>;

function create(body: unknown, headers: Headers = {}) {
  return call(createPost, { method: "POST", path: "/api/posts", body, headers });
}

function read(id: string, headers: Headers = {}) {
  return call(getPost, { path: `/api/posts/${id}`, headers, params: { id } });
}

function edit(id: string, body: unknown, headers: Headers = {}) {
  return call(patchPost, {
    method: "PATCH",
    path: `/api/posts/${id}`,
    body,
    headers,
    params: { id },
  });
}

/** Signs in a fresh author and saves a draft for them. */
async function authorWithDraft(body: unknown = draft) {
  const author = await signedIn();
  const res = await create(body, author.headers);
  expect(res.status).toBe(201);
  return { ...author, post: res.body.post };
}

describe("POST /api/posts", () => {
  it("saves a draft only its author can see, even when unverified", async () => {
    const { user, headers } = await signedIn({ verified: false });

    const res = await create(draft, headers);

    expect(res.status).toBe(201);
    expect(res.body.post).toMatchObject({
      id: expect.any(String),
      slug: "notes-toward-an-essay-on-walking",
      title: draft.title,
      description: draft.description,
      summary: draft.description,
      content: draft.content,
      html: "<p>I walk the same loop most mornings.</p>",
      coverUrl: null,
      status: "draft",
      publishedAt: null,
      author: { id: user.id, username: user.username },
    });
    expect(await db().post.count()).toBe(1);
  });

  it("returns 401 when nobody is signed in", async () => {
    const res = await create(draft);

    expect(res.status).toBe(401);
    expect(await db().post.count()).toBe(0);
  });

  it("trims the title and description and stores a blank description as null", async () => {
    const { headers } = await signedIn();

    const res = await create({ ...draft, title: "  Walking  ", description: "   " }, headers);

    expect(res.status).toBe(201);
    expect(res.body.post.title).toBe("Walking");
    expect(res.body.post.description).toBeNull();
  });

  describe("description fallback", () => {
    it("uses the start of the content when there is no description", async () => {
      const { headers } = await signedIn();

      const res = await create(
        { title: "Walking", content: doc(paragraph("First line."), paragraph("Second line.")) },
        headers,
      );

      expect(res.body.post.description).toBeNull();
      expect(res.body.post.summary).toBe("First line. Second line.");
    });

    it("cuts long content to about 160 characters", async () => {
      const { headers } = await signedIn();
      const long = "word ".repeat(100).trim();

      const res = await create({ title: "Walking", content: doc(paragraph(long)) }, headers);

      const summary: string = res.body.post.summary;
      expect(summary.length).toBeLessThanOrEqual(161);
      expect(summary.endsWith("…")).toBe(true);
      expect(long.startsWith(summary.slice(0, -1))).toBe(true);
    });
  });

  describe("validation", () => {
    it.each([
      ["missing", undefined, "Add a title."],
      ["blank", "   ", "Add a title."],
      ["over 150 characters", "a".repeat(151), "Keep the title to 150 characters."],
    ])("rejects a title that is %s", async (_, title, message) => {
      const { headers } = await signedIn();

      const res = await create({ ...draft, title }, headers);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(res.body.error.fields).toEqual({ title: [message] });
    });

    it("accepts a title of exactly 150 characters", async () => {
      const { headers } = await signedIn();

      const res = await create({ ...draft, title: "a".repeat(150) }, headers);

      expect(res.status).toBe(201);
    });

    it("rejects a description over 200 characters and accepts exactly 200", async () => {
      const { headers } = await signedIn();

      const over = await create({ ...draft, description: "d".repeat(201) }, headers);
      const exact = await create({ ...draft, description: "d".repeat(200) }, headers);

      expect(over.status).toBe(400);
      expect(over.body.error.fields).toEqual({
        description: ["Keep the description to 200 characters."],
      });
      expect(exact.status).toBe(201);
    });

    it.each([
      ["missing content", undefined],
      ["an empty document", doc()],
      ["only empty paragraphs", doc({ type: "paragraph" }, paragraph("   "))],
      ["a document with no content list", { type: "doc" }],
    ])("rejects %s", async (_, content) => {
      const { headers } = await signedIn();

      const res = await create({ ...draft, content }, headers);

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.fields)).toEqual(["content"]);
      expect(await db().post.count()).toBe(0);
    });

    it.each([
      ["a table", doc({ type: "table", content: [] })],
      ["a raw HTML node", doc({ type: "html", attrs: { html: "<script>alert(1)</script>" } })],
      ["an iframe", doc({ type: "iframe", attrs: { src: "https://evil.example" } })],
      [
        "an underline mark",
        doc({ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "underline" }] }] }),
      ],
      ["a level-1 heading", doc({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "x" }] })],
      ["a list item outside a list", doc({ type: "listItem", content: [paragraph("x")] })],
      ["a paragraph directly inside a list", doc({ type: "bulletList", content: [paragraph("x")] })],
      [
        "a javascript: link",
        doc({
          type: "paragraph",
          content: [
            { type: "text", text: "click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
          ],
        }),
      ],
      ["an image with a data: URL", doc({ type: "image", attrs: { src: "data:image/png;base64,AAAA" } })],
    ])("rejects content containing %s with 400", async (_, content) => {
      const { headers } = await signedIn();

      const res = await create({ ...draft, content }, headers);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(res.body.error.fields)).toEqual(["content"]);
      expect(await db().post.count()).toBe(0);
    });

    it("drops attributes it doesn't know instead of storing them", async () => {
      const { headers } = await signedIn();
      const content = doc({
        type: "paragraph",
        attrs: { style: "color:red", onclick: "alert(1)" },
        content: [
          {
            type: "text",
            text: "Pencil",
            marks: [{ type: "link", attrs: { href: "https://pencil.example", onmouseover: "x", class: "y" } }],
          },
        ],
      });

      const res = await create({ ...draft, content }, headers);

      expect(res.status).toBe(201);
      expect(res.body.post.content).toEqual(
        doc({
          type: "paragraph",
          content: [
            { type: "text", text: "Pencil", marks: [{ type: "link", attrs: { href: "https://pencil.example" } }] },
          ],
        }),
      );
    });

    it("rejects content nested deeper than any real post", async () => {
      const { headers } = await signedIn();
      let node: unknown = paragraph("deep");
      for (let i = 0; i < 30; i++) node = { type: "blockquote", content: [node] };

      const res = await create({ ...draft, content: doc(node) }, headers);

      expect(res.status).toBe(400);
      expect(res.body.error.fields.content).toEqual(["Content is nested too deeply."]);
    });

    it("rejects a request body over the size limit", async () => {
      const { headers } = await signedIn();
      const huge = doc(paragraph("x".repeat(3 * 1024 * 1024)));

      const res = await create({ ...draft, content: huge }, headers);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Request body is too large.");
    });

    it("rejects a body that isn't JSON", async () => {
      const { headers } = await signedIn();

      const res = await create("{not json", headers);

      expect(res.status).toBe(400);
    });
  });

  describe("slugs", () => {
    it("adds -2, -3 when the title's slug is taken", async () => {
      const { headers } = await signedIn();
      const other = await signedIn();

      const first = await create(draft, headers);
      const second = await create(draft, other.headers);
      const third = await create({ ...draft, title: "Notes Toward an Essay on Walking!" }, headers);

      expect(first.body.post.slug).toBe("notes-toward-an-essay-on-walking");
      expect(second.body.post.slug).toBe("notes-toward-an-essay-on-walking-2");
      expect(third.body.post.slug).toBe("notes-toward-an-essay-on-walking-3");
    });

    it("gives every post its own slug when the same title is saved at once", async () => {
      const { headers } = await signedIn();

      const results = await Promise.all([1, 2, 3, 4].map(() => create(draft, headers)));

      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
      const slugs = new Set(results.map((r) => r.body.post.slug));
      expect(slugs.size).toBe(4);
    });
  });
});

describe("GET /api/posts/:id", () => {
  it("returns the author's own draft", async () => {
    const { post, headers } = await authorWithDraft();

    const res = await read(post.id, headers);

    expect(res.status).toBe(200);
    expect(res.body.post).toEqual(post);
  });

  it("returns 404 for someone else's draft, the same as for a missing post", async () => {
    const { post } = await authorWithDraft();
    const stranger = await signedIn({ verified: true });

    const theirs = await read(post.id, stranger.headers);
    const missing = await read("01936f0e-0000-7000-8000-000000000000", stranger.headers);

    expect(theirs.status).toBe(404);
    expect(theirs.body).toEqual(missing.body);
  });

  it("returns 404 for a draft when logged out", async () => {
    const { post } = await authorWithDraft();

    const res = await read(post.id);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns a published post to anyone", async () => {
    const { post } = await authorWithDraft();
    await db().post.update({ where: { id: post.id }, data: { publishedAt: new Date() } });

    const res = await read(post.id);

    expect(res.status).toBe(200);
    expect(res.body.post.status).toBe("published");
  });

  it("returns 404 for a deleted post, even to its author", async () => {
    const { post, headers } = await authorWithDraft();
    await db().post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });

    expect((await read(post.id, headers)).status).toBe(404);
  });

  it("returns 404 for an id that isn't a post id", async () => {
    const { headers } = await signedIn();

    expect((await read("not-a-uuid", headers)).status).toBe(404);
  });

  it("returns HTML with no script-capable output", async () => {
    const content = doc(
      paragraph('<script>alert("x")</script><img src=x onerror=alert(1)>'),
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "a link",
            marks: [{ type: "link", attrs: { href: 'https://pencil.example/"><script>alert(1)</script>' } }],
          },
        ],
      },
      {
        type: "codeBlock",
        attrs: { language: "html" },
        content: [{ type: "text", text: "<button onclick=\"alert(1)\">hi</button>" }],
      },
    );
    const { post, headers } = await authorWithDraft({ ...draft, content });

    const { html } = (await read(post.id, headers)).body.post as { html: string };

    // Text can't contain a raw "<", so every "<" in the output starts a real tag.
    const tags = [...html.matchAll(/<\/?([a-z0-9]+)([^>]*)>/gi)];
    expect(tags.map((t) => t[1].toLowerCase())).toEqual(
      expect.arrayContaining(["p", "a", "pre", "code"]),
    );
    for (const [, name, attrs] of tags) {
      expect(["p", "a", "pre", "code"]).toContain(name.toLowerCase());
      expect(attrs).not.toMatch(/\son\w+\s*=/i);
      expect(attrs).not.toMatch(/javascript:/i);
    }
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"');
  });
});

describe("PATCH /api/posts/:id", () => {
  it("updates the title, description and content but never the slug", async () => {
    const { post, headers } = await authorWithDraft();

    const res = await edit(
      post.id,
      {
        title: "A completely different title",
        description: null,
        content: doc(paragraph("Rewritten.")),
      },
      headers,
    );

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({
      slug: "notes-toward-an-essay-on-walking",
      title: "A completely different title",
      description: null,
      summary: "Rewritten.",
      html: "<p>Rewritten.</p>",
    });
    expect((await read(post.id, headers)).body.post.title).toBe("A completely different title");
  });

  it("changes only the fields that are sent", async () => {
    const { post, headers } = await authorWithDraft();

    const res = await edit(post.id, { title: "New title" }, headers);

    expect(res.body.post).toMatchObject({
      title: "New title",
      description: draft.description,
      content: draft.content,
    });
  });

  it("validates edits the same way as new drafts", async () => {
    const { post, headers } = await authorWithDraft();

    const res = await edit(
      post.id,
      { title: "", content: doc({ type: "video", attrs: { src: "https://x.example" } }) },
      headers,
    );

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["content", "title"]);
    expect((await read(post.id, headers)).body.post.title).toBe(draft.title);
  });

  it("returns 404 to another user editing a draft and leaves it unchanged", async () => {
    const { post, headers } = await authorWithDraft();
    const stranger = await signedIn({ verified: true });

    const res = await edit(post.id, { title: "Hijacked" }, stranger.headers);

    expect(res.status).toBe(404);
    expect((await read(post.id, headers)).body.post.title).toBe(draft.title);
  });

  it("returns 403 to another user editing a published post", async () => {
    const { post } = await authorWithDraft();
    await db().post.update({ where: { id: post.id }, data: { publishedAt: new Date() } });
    const stranger = await signedIn({ verified: true });

    const res = await edit(post.id, { title: "Hijacked" }, stranger.headers);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect((await read(post.id)).body.post.title).toBe(draft.title);
  });

  it("returns 401 when logged out", async () => {
    const { post } = await authorWithDraft();

    expect((await edit(post.id, { title: "Hijacked" })).status).toBe(401);
  });

  it("returns 404 for a deleted post", async () => {
    const { post, headers } = await authorWithDraft();
    await db().post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });

    expect((await edit(post.id, { title: "Back" }, headers)).status).toBe(404);
  });
});
