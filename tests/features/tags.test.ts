import { describe, expect, it } from "vitest";
import { PATCH as updatePost } from "@/app/api/posts/[id]/route";
import { POST as publishPost } from "@/app/api/posts/[id]/publish/route";
import { GET as listFeed, POST as createPost } from "@/app/api/posts/route";
import { GET as listTagPosts } from "@/app/api/tags/[tag]/posts/route";
import { GET as suggestTags } from "@/app/api/tags/route";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { call } from "../helpers/request";

type Author = Awaited<ReturnType<typeof signedIn>>;
type Card = { id: string; title: string; tags: string[] };

const content = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

function create(author: Author, title: string, tags?: unknown) {
  return call(createPost, {
    method: "POST",
    path: "/api/posts",
    body: { title, content: content(`The body of ${title}.`), ...(tags !== undefined && { tags }) },
    headers: author.headers,
  });
}

async function createDraft(author: Author, title: string, tags?: string[]) {
  const res = await create(author, title, tags);
  expect(res.status).toBe(201);
  return res.body.post as { id: string; slug: string; tags: string[] };
}

function update(author: Author, id: string, body: object) {
  return call(updatePost, {
    method: "PATCH",
    path: `/api/posts/${id}`,
    body,
    headers: author.headers,
    params: { id },
  });
}

async function publish(author: Author, id: string) {
  const res = await call(publishPost, {
    method: "POST",
    path: `/api/posts/${id}/publish`,
    headers: author.headers,
    params: { id },
  });
  expect(res.status).toBe(200);
  return res.body.post as { id: string; slug: string };
}

async function published(author: Author, title: string, tags: string[]) {
  return publish(author, (await createDraft(author, title, tags)).id);
}

function tagPage(tag: string, cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return call(listTagPosts, {
    path: `/api/tags/${encodeURIComponent(tag)}/posts${query}`,
    params: { tag },
  });
}

function suggestions(q?: string) {
  return call(suggestTags, { path: q === undefined ? "/api/tags" : `/api/tags?q=${encodeURIComponent(q)}` });
}

describe("tags on posts", () => {
  it("saves a draft's tags normalized, in the author's order", async () => {
    const author = await signedIn();

    const res = await create(author, "Walking", ["Essays", "#walking", "Slow Living"]);

    expect(res.status).toBe(201);
    expect(res.body.post.tags).toEqual(["essays", "walking", "slow-living"]);
  });

  it("defaults to no tags", async () => {
    const author = await signedIn();

    const post = await createDraft(author, "Untagged");

    expect(post.tags).toEqual([]);
  });

  it("shares one tag between differently-cased input on different posts", async () => {
    const lina = await signedIn();
    const omar = await signedIn();

    await createDraft(lina, "First", ["React"]);
    await createDraft(omar, "Second", ["react"]);
    await createDraft(omar, "Third", ["REACT", "#react"]);

    expect(await db().tag.findMany({ select: { name: true } })).toEqual([{ name: "react" }]);
    expect(await db().postTag.count()).toBe(3);
  });

  it("rejects more than 5 tags with 400", async () => {
    const author = await signedIn();

    const res = await create(author, "Too many", ["a", "b", "c", "d", "e", "f"]);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.tags).toEqual(["Use up to 5 tags."]);
    expect(await db().post.count()).toBe(0);
  });

  it("rejects more than 5 tags on edit with 400 and keeps the old ones", async () => {
    const author = await signedIn();
    const post = await createDraft(author, "Tagged", ["one"]);

    const res = await update(author, post.id, { tags: ["a", "b", "c", "d", "e", "f"] });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.tags).toEqual(["Use up to 5 tags."]);
    const tags = await db().postTag.findMany({ where: { postId: post.id }, include: { tag: true } });
    expect(tags.map((t) => t.tag.name)).toEqual(["one"]);
  });

  it.each([[["c++"]], [["next.js"]], [[""]], ["react"], [[42]]])(
    "rejects tags %j with 400",
    async (tags) => {
      const author = await signedIn();

      const res = await create(author, "Bad tags", tags);

      expect(res.status).toBe(400);
      expect(res.body.error.fields.tags).toHaveLength(1);
    },
  );

  it("replaces the tags on edit, and leaves them alone when not sent", async () => {
    const author = await signedIn();
    const post = await createDraft(author, "Tagged", ["one", "two"]);

    const replaced = await update(author, post.id, { tags: ["Three", "one"] });
    const untouched = await update(author, post.id, { title: "Retitled" });

    expect(replaced.status).toBe(200);
    expect(replaced.body.post.tags).toEqual(["three", "one"]);
    expect(untouched.body.post.tags).toEqual(["three", "one"]);
  });

  it("clears the tags when sent an empty list", async () => {
    const author = await signedIn();
    const post = await createDraft(author, "Tagged", ["one", "two"]);

    const res = await update(author, post.id, { tags: [] });

    expect(res.body.post.tags).toEqual([]);
    expect(await db().postTag.count()).toBe(0);
  });

  it("marks a published post edited when its tags change, not when they're resent", async () => {
    const time = fakeClock();
    const author = await signedIn({ verified: true });
    const post = await published(author, "Tagged", ["one"]);
    time.advance(60_000);

    const same = await update(author, post.id, { tags: ["One"] });
    const changed = await update(author, post.id, { tags: ["one", "two"] });

    expect(same.body.post.editedAt).toBeNull();
    expect(changed.body.post.editedAt).toBe("2026-01-01T00:01:00.000Z");
  });

  it("only lets the author change tags", async () => {
    const author = await signedIn({ verified: true });
    const other = await signedIn({ verified: true });
    const post = await published(author, "Mine", ["one"]);

    const res = await update(other, post.id, { tags: ["spam"] });

    expect(res.status).toBe(403);
    expect(await db().tag.count({ where: { name: "spam" } })).toBe(0);
  });

  it("shows tags on feed cards", async () => {
    const author = await signedIn({ verified: true });
    await published(author, "Tagged", ["Writing", "craft"]);

    const res = await call(listFeed, { path: "/api/posts" });

    expect(res.body.posts.map((p: Card) => p.tags)).toEqual([["writing", "craft"]]);
  });
});

describe("GET /api/tags/:tag/posts (a tag page)", () => {
  it("lists published posts with the tag, newest first, 10 a page, to logged-out readers", async () => {
    const time = fakeClock();
    const author = await signedIn({ verified: true });
    for (let i = 1; i <= 12; i++) {
      time.advance(60_000);
      await published(author, `Writing ${i}`, ["writing"]);
      await published(author, `Other ${i}`, ["other"]);
    }

    const first = await tagPage("writing");
    const second = await tagPage("writing", first.body.nextCursor);

    expect(first.status).toBe(200);
    expect(first.body.posts.map((p: Card) => p.title)).toEqual(
      [12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `Writing ${n}`),
    );
    expect(second.body.posts.map((p: Card) => p.title)).toEqual(["Writing 2", "Writing 1"]);
    expect(second.body.nextCursor).toBeNull();
  });

  it("leaves out drafts and deleted posts", async () => {
    const author = await signedIn({ verified: true });
    const kept = await published(author, "Kept", ["writing"]);
    const deleted = await published(author, "Deleted", ["writing"]);
    await createDraft(author, "Draft", ["writing"]);
    await db().post.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    const res = await tagPage("writing");

    expect(res.body.posts.map((p: Card) => p.id)).toEqual([kept.id]);
  });

  it("has no duplicates when a post with the tag is published between pages", async () => {
    const time = fakeClock();
    const author = await signedIn({ verified: true });
    const older = [];
    for (let i = 1; i <= 12; i++) {
      time.advance(60_000);
      older.push(await published(author, `Post ${i}`, ["writing"]));
    }
    const waiting = await createDraft(author, "Mid-scroll", ["writing"]);

    const first = await tagPage("writing");
    time.advance(60_000);
    await publish(author, waiting.id);
    const second = await tagPage("writing", first.body.nextCursor);

    const seen = [...first.body.posts, ...second.body.posts].map((p: Card) => p.id);
    expect(seen).toEqual(older.map((p) => p.id).reverse());
  });

  it("shows each card's full tag list, not just the matching tag", async () => {
    const author = await signedIn({ verified: true });
    await published(author, "Both", ["craft", "writing"]);

    const res = await tagPage("writing");

    expect(res.body.posts[0].tags).toEqual(["craft", "writing"]);
  });

  it("matches the tag however it is cased in the URL", async () => {
    const author = await signedIn({ verified: true });
    const post = await published(author, "Tagged", ["react"]);

    const res = await tagPage("React");

    expect(res.body.posts.map((p: Card) => p.id)).toEqual([post.id]);
  });

  it("returns an empty page for a tag no published post uses", async () => {
    const author = await signedIn({ verified: true });
    await createDraft(author, "Draft", ["woodworking"]);

    for (const tag of ["woodworking", "never-used"]) {
      const res = await tagPage(tag);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ posts: [], nextCursor: null });
    }
  });

  it("returns 404 for something that can't be a tag", async () => {
    const res = await tagPage("c++");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects a cursor it didn't issue with 400", async () => {
    const res = await tagPage("writing", "garbage");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/tags?q= (autocomplete)", () => {
  it("suggests existing tags starting with the query, most used first", async () => {
    const author = await signedIn({ verified: true });
    await published(author, "One", ["writing", "writing-life"]);
    await published(author, "Two", ["writing"]);
    await published(author, "Three", ["rewriting"]);

    const res = await suggestions("Writ");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      tags: [
        { name: "writing", postCount: 2 },
        { name: "writing-life", postCount: 1 },
      ],
    });
  });

  it("counts and suggests only tags on published, non-deleted posts", async () => {
    const author = await signedIn({ verified: true });
    await published(author, "Live", ["walking"]);
    const gone = await published(author, "Gone", ["walking", "wandering"]);
    await createDraft(author, "Secret", ["walking", "whispers"]);
    await db().post.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });

    const res = await suggestions("w");

    expect(res.body.tags).toEqual([{ name: "walking", postCount: 1 }]);
  });

  it("returns the most used tags when the query is empty", async () => {
    const author = await signedIn({ verified: true });
    await published(author, "One", ["b", "a"]);
    await published(author, "Two", ["b"]);

    for (const q of [undefined, ""]) {
      expect((await suggestions(q)).body.tags).toEqual([
        { name: "b", postCount: 2 },
        { name: "a", postCount: 1 },
      ]);
    }
  });

  it("returns at most 8 suggestions", async () => {
    const author = await signedIn({ verified: true });
    for (let i = 0; i < 2; i++) {
      await published(author, `Post ${i}`, ["t1", "t2", "t3", "t4", "t5"].map((t) => `${t}${i}`));
    }

    expect((await suggestions("t")).body.tags).toHaveLength(8);
  });

  it("returns nothing for a query that can't start a tag", async () => {
    const author = await signedIn({ verified: true });
    await published(author, "One", ["c"]);

    const res = await suggestions("c++");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tags: [] });
  });

  it("treats LIKE wildcards in the query as plain text", async () => {
    const author = await signedIn({ verified: true });
    await published(author, "One", ["abc"]);

    expect((await suggestions("%")).body.tags).toEqual([]);
    expect((await suggestions("a_c")).body.tags).toEqual([]);
  });
});
