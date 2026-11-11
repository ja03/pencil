import { describe, expect, it } from "vitest";
import { POST as publishPost } from "@/app/api/posts/[id]/publish/route";
import { GET as listPosts, POST as createPost } from "@/app/api/posts/route";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { call } from "../helpers/request";

type Author = Awaited<ReturnType<typeof signedIn>>;

const content = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function createDraft(author: Author, title: string) {
  const res = await call(createPost, {
    method: "POST",
    path: "/api/posts",
    body: { title, content: content(`The body of ${title}.`) },
    headers: author.headers,
  });
  expect(res.status).toBe(201);
  return res.body.post as { id: string; slug: string };
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

/** Publishes `count` posts, one a minute apart (or all at once when `step` is 0). */
async function publishMany(author: Author, count: number, time = fakeClock(), step = 60_000) {
  const posts = [];
  for (let i = 1; i <= count; i++) {
    time.advance(step);
    posts.push(await publish(author, (await createDraft(author, `Post ${i}`)).id));
  }
  return posts;
}

function feed(cursor?: string) {
  const path = cursor ? `/api/posts?cursor=${encodeURIComponent(cursor)}` : "/api/posts";
  return call(listPosts, { path });
}

/** Every page of the feed, following cursors until there are none. */
async function wholeFeed() {
  const pages = [];
  let cursor: string | undefined;
  do {
    const res = await feed(cursor);
    expect(res.status).toBe(200);
    pages.push(res.body.posts as { id: string; title: string }[]);
    cursor = res.body.nextCursor ?? undefined;
  } while (cursor);
  return pages;
}

describe("GET /api/posts (the public feed)", () => {
  it("lists published posts newest first, 10 a page, to logged-out readers", async () => {
    const author = await signedIn({ verified: true });
    await publishMany(author, 12);

    const first = await feed();
    const second = await feed(first.body.nextCursor);

    expect(first.status).toBe(200);
    expect(first.body.posts.map((p: { title: string }) => p.title)).toEqual(
      [12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `Post ${n}`),
    );
    expect(first.body.nextCursor).toEqual(expect.any(String));
    expect(second.body.posts.map((p: { title: string }) => p.title)).toEqual(["Post 2", "Post 1"]);
    expect(second.body.nextCursor).toBeNull();
  });

  it("returns an empty first page when nothing is published", async () => {
    const res = await feed();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ posts: [], nextCursor: null });
  });

  it("returns cards with what the feed shows, not the post body", async () => {
    const time = fakeClock(new Date("2026-03-01T09:00:00Z"));
    const author = await signedIn({ verified: true });
    const post = await publish(author, (await createDraft(author, "Walking")).id);
    time.advance(1000);

    const [card] = (await feed()).body.posts;

    expect(card).toEqual({
      id: post.id,
      slug: "walking",
      title: "Walking",
      summary: "The body of Walking.",
      coverUrl: null,
      readingMinutes: 1,
      tags: [],
      publishedAt: "2026-03-01T09:00:00.000Z",
      editedAt: null,
      author: { id: author.user.id, username: author.user.username },
      likeCount: 0,
      likedByViewer: false,
      commentCount: 0,
    });
  });

  it("leaves out drafts and deleted posts", async () => {
    const author = await signedIn({ verified: true });
    const [kept, deleted] = await publishMany(author, 2);
    await createDraft(author, "Still a draft");
    await db().post.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    const res = await feed();

    expect(res.body.posts.map((p: { id: string }) => p.id)).toEqual([kept.id]);
  });

  it("has no duplicates or skipped posts when a post is published between pages", async () => {
    const time = fakeClock();
    const author = await signedIn({ verified: true });
    const older = await publishMany(author, 15, time);
    const waiting = await createDraft(author, "Published mid-scroll");

    const first = await feed();
    time.advance(60_000);
    await publish(author, waiting.id);
    const second = await feed(first.body.nextCursor);

    const seen = [...first.body.posts, ...second.body.posts].map((p: { id: string }) => p.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(older.map((p) => p.id).reverse());
    expect(second.body.nextCursor).toBeNull();
    // The new post is waiting at the top for the next refresh.
    expect((await feed()).body.posts[0].id).toBe(waiting.id);
  });

  it("pages through posts published at the same instant without losing any", async () => {
    const time = fakeClock();
    const author = await signedIn({ verified: true });
    const posts = await publishMany(author, 23, time, 0);

    const pages = await wholeFeed();

    expect(pages.map((p) => p.length)).toEqual([10, 10, 3]);
    const ids = pages.flat().map((p) => p.id);
    expect(new Set(ids).size).toBe(23);
    expect([...ids].sort()).toEqual(posts.map((p) => p.id).sort());
  });

  it.each([["garbage"], ["bm90IGEgY3Vyc29y"], [""]])(
    "rejects a cursor it didn't issue (%j) with 400",
    async (cursor) => {
      const res = await call(listPosts, { path: `/api/posts?cursor=${encodeURIComponent(cursor)}` });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    },
  );
});
