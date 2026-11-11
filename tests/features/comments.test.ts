import { beforeEach, describe, expect, it } from "vitest";
import { GET as listRoute, POST as createRoute } from "@/app/api/posts/[id]/comments/route";
import { GET as getPost } from "@/app/api/posts/[id]/route";
import { GET as getFeed } from "@/app/api/posts/route";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { draftBy, publishedBy, type Author } from "../helpers/posts";
import { call } from "../helpers/request";

const MINUTE = 60_000;
const UNKNOWN_ID = "00000000-0000-7000-8000-000000000000";

type Headers = Record<string, string>;

let ip = 0;
/** A different client IP for each request, so the rate limit stays out of the way. */
const freshIp = () => ({ "x-forwarded-for": `198.51.100.${(ip = (ip + 1) % 250)}` });

function comment(postId: string, headers: Headers, body: unknown) {
  return call(createRoute, {
    method: "POST",
    path: `/api/posts/${postId}/comments`,
    headers: { ...freshIp(), ...headers },
    body,
    params: { id: postId },
  });
}

function list(postId: string, cursor?: string | null, headers: Headers = {}) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return call(listRoute, {
    path: `/api/posts/${postId}/comments${query}`,
    headers,
    params: { id: postId },
  });
}

/** Posts `body` as `author` and returns the new comment's id. */
async function commentBy(author: Author, postId: string, body: string, parentId?: string) {
  const res = await comment(postId, author.headers, { body, parentId });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.comment.id as string;
}

let time: ReturnType<typeof fakeClock>;

beforeEach(() => {
  time = fakeClock();
});

async function aPublishedPost(title = "On walking") {
  const author = await signedIn({ verified: true });
  return { author, post: await publishedBy(author, title) };
}

describe("POST /api/posts/:id/comments", () => {
  it("adds a top-level comment and returns it", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });

    const res = await comment(post.id, reader.headers, { body: "  Lovely piece.  " });

    expect(res.status).toBe(201);
    expect(res.body.comment).toEqual({
      id: expect.any(String),
      parentId: null,
      body: "Lovely piece.",
      createdAt: "2026-01-01T00:00:00.000Z",
      author: { id: reader.user.id, username: reader.user.username },
    });
    const row = await db().comment.findUniqueOrThrow({ where: { id: res.body.comment.id } });
    expect(row).toMatchObject({ postId: post.id, authorId: reader.user.id, body: "Lovely piece." });
  });

  it("lets authors comment on their own posts", async () => {
    const { author, post } = await aPublishedPost();

    const res = await comment(post.id, author.headers, { body: "Thanks for reading." });

    expect(res.status).toBe(201);
  });

  it("adds a reply to a top-level comment", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    const parentId = await commentBy(reader, post.id, "First!");

    const res = await comment(post.id, reader.headers, { body: "Replying.", parentId });

    expect(res.status).toBe(201);
    expect(res.body.comment).toMatchObject({ parentId, body: "Replying." });
  });

  it("rejects a reply to a reply with 400, so threads stay one level deep", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    const top = await commentBy(reader, post.id, "Top");
    const reply = await commentBy(reader, post.id, "Reply", top);

    const res = await comment(post.id, reader.headers, { body: "Too deep", parentId: reply });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_FAILED",
      message: "You can only reply to a top-level comment.",
      fields: { parentId: ["You can only reply to a top-level comment."] },
    });
    expect(await db().comment.count()).toBe(2);
  });

  it("rejects a parent that doesn't exist or belongs to another post", async () => {
    const { post } = await aPublishedPost();
    const { post: other } = await aPublishedPost("Another");
    const reader = await signedIn({ verified: true });
    const elsewhere = await commentBy(reader, other.id, "Over there");

    for (const parentId of [elsewhere, UNKNOWN_ID, "nope"]) {
      const res = await comment(post.id, reader.headers, { body: "Hi", parentId });
      expect(res.status, parentId).toBe(400);
      expect(res.body.error.fields.parentId).toEqual(["That comment doesn't exist."]);
    }
    expect(await db().comment.count({ where: { postId: post.id } })).toBe(0);
  });

  it("accepts 1000 characters and rejects 1001", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });

    const ok = await comment(post.id, reader.headers, { body: "a".repeat(1000) });
    const tooLong = await comment(post.id, reader.headers, { body: "a".repeat(1001) });

    expect(ok.status).toBe(201);
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.fields).toEqual({ body: ["Keep comments to 1,000 characters."] });
    expect(await db().comment.count()).toBe(1);
  });

  it("rejects an empty or missing body", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });

    for (const body of [{ body: "   " }, {}, { body: 42 }]) {
      const res = await comment(post.id, reader.headers, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.fields.body).toEqual(["Write something first."]);
    }
  });

  it("returns 403 to an unverified reader and records nothing", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: false });

    const res = await comment(post.id, reader.headers, { body: "Hello" });

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "FORBIDDEN", message: "Verify your email to comment." });
    expect(await db().comment.count()).toBe(0);
  });

  it("returns 401 when logged out", async () => {
    const { post } = await aPublishedPost();

    const res = await comment(post.id, {}, { body: "Hello" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 404 for a draft, a deleted post or an unknown id", async () => {
    const author = await signedIn({ verified: true });
    const draft = await draftBy(author, "Not yet");
    const { post: deleted } = await aPublishedPost();
    await db().post.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    for (const id of [draft.id, deleted.id, UNKNOWN_ID, "nope"]) {
      const res = await comment(id, author.headers, { body: "Hello" });
      expect(res.status, id).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    expect(await db().comment.count()).toBe(0);
  });
});

describe("comment rate limit per IP", () => {
  const sameIp = { "x-forwarded-for": "203.0.113.7" };

  async function burst(postId: string, headers: Headers, n: number) {
    const statuses: number[] = [];
    for (let i = 0; i < n; i++) {
      const res = await comment(postId, { ...headers, ...sameIp }, { body: `Comment ${i}` });
      statuses.push(res.status);
    }
    return statuses;
  }

  it("answers the 6th comment within a minute from one IP with 429", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });

    expect(await burst(post.id, reader.headers, 5)).toEqual([201, 201, 201, 201, 201]);
    const sixth = await comment(post.id, { ...reader.headers, ...sameIp }, { body: "Again" });

    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({ error: { code: "RATE_LIMITED", message: expect.any(String) } });
    expect(Number(sixth.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await db().comment.count()).toBe(5);
  });

  it("lets the IP comment again once the minute has passed", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    await burst(post.id, reader.headers, 5);

    time.advance(MINUTE);
    const res = await comment(post.id, { ...reader.headers, ...sameIp }, { body: "Later" });

    expect(res.status).toBe(201);
  });

  it("doesn't slow down other IPs", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    await burst(post.id, reader.headers, 5);

    const res = await comment(post.id, reader.headers, { body: "From elsewhere" });

    expect(res.status).toBe(201);
  });
});

describe("GET /api/posts/:id/comments", () => {
  /** Writes `n` top-level comments one second apart; returns their ids, oldest first. */
  async function threads(author: Author, postId: string, n: number) {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      ids.push(await commentBy(author, postId, `Comment ${i}`));
      time.advance(1000);
    }
    return ids;
  }

  const idsOf = (res: Awaited<ReturnType<typeof list>>) =>
    res.body.comments.map((c: { id: string }) => c.id);

  it("lists top-level comments newest first, readable when logged out", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    const ids = await threads(reader, post.id, 3);

    const res = await list(post.id);

    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([...ids].reverse());
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.comments[0]).toEqual({
      id: ids[2],
      parentId: null,
      body: "Comment 2",
      createdAt: "2026-01-01T00:00:02.000Z",
      author: { id: reader.user.id, username: reader.user.username },
      replies: [],
    });
  });

  it("is empty for a post with no comments", async () => {
    const { post } = await aPublishedPost();

    const res = await list(post.id);

    expect(res.body).toEqual({ comments: [], nextCursor: null });
  });

  it("pages 20 at a time with a cursor until the end", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    const newestFirst = (await threads(reader, post.id, 45)).reverse();

    const first = await list(post.id);
    const second = await list(post.id, first.body.nextCursor);
    const third = await list(post.id, second.body.nextCursor);

    expect(idsOf(first)).toEqual(newestFirst.slice(0, 20));
    expect(idsOf(second)).toEqual(newestFirst.slice(20, 40));
    expect(idsOf(third)).toEqual(newestFirst.slice(40));
    expect(first.body.nextCursor).toEqual(expect.any(String));
    expect(third.body.nextCursor).toBeNull();
  });

  it("has no next page when the comments fill exactly one page", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    await threads(reader, post.id, 20);

    const res = await list(post.id);

    expect(res.body.comments).toHaveLength(20);
    expect(res.body.nextCursor).toBeNull();
  });

  it("orders comments from the same moment by id, without skipping or repeating any", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    // The clock stands still, so every comment shares one createdAt.
    for (let i = 0; i < 25; i++) await commentBy(reader, post.id, `Same time ${i}`);

    const first = await list(post.id);
    const second = await list(post.id, first.body.nextCursor);

    const seen = [...idsOf(first), ...idsOf(second)];
    expect(new Set(seen).size).toBe(25);
    expect(seen).toEqual([...seen].sort().reverse());
  });

  it("doesn't repeat comments when a new one arrives between page loads", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    const newestFirst = (await threads(reader, post.id, 25)).reverse();

    const first = await list(post.id);
    await commentBy(reader, post.id, "Late arrival");
    const second = await list(post.id, first.body.nextCursor);

    expect(idsOf(second)).toEqual(newestFirst.slice(20));
  });

  it("returns every reply with its comment, oldest first, and never as a top-level comment", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    const other = await signedIn({ verified: true });
    const [older, newer] = await threads(reader, post.id, 2);
    const replies: string[] = [];
    for (let i = 0; i < 25; i++) {
      replies.push(await commentBy(i % 2 ? other : reader, post.id, `Reply ${i}`, older));
      time.advance(1000);
    }
    const toNewer = await commentBy(other, post.id, "To the newer one", newer);

    const res = await list(post.id);

    expect(idsOf(res)).toEqual([newer, older]);
    const [newerThread, olderThread] = res.body.comments;
    expect(newerThread.replies.map((r: { id: string }) => r.id)).toEqual([toNewer]);
    expect(olderThread.replies.map((r: { id: string }) => r.id)).toEqual(replies);
    expect(olderThread.replies[1]).toMatchObject({
      parentId: older,
      body: "Reply 1",
      author: { id: other.user.id, username: other.user.username },
    });
  });

  it("rejects a cursor it didn't issue with 400", async () => {
    const { post } = await aPublishedPost();

    const res = await list(post.id, "not-a-cursor");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns 404 for a draft, a deleted post or an unknown id", async () => {
    const author = await signedIn({ verified: true });
    const draft = await draftBy(author, "Not yet");
    const { post: deleted } = await aPublishedPost();
    await db().post.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    for (const id of [draft.id, deleted.id, UNKNOWN_ID, "nope"]) {
      const res = await list(id, null, author.headers);
      expect(res.status, id).toBe(404);
    }
  });
});

describe("comment counts on posts", () => {
  it("counts comments and replies on feed cards and the post", async () => {
    const { post } = await aPublishedPost("Talked about");
    const { post: quiet } = await aPublishedPost("Quiet");
    const reader = await signedIn({ verified: true });
    const top = await commentBy(reader, post.id, "One");
    await commentBy(reader, post.id, "Two");
    await commentBy(reader, post.id, "A reply", top);

    const feed = await call(getFeed, { path: "/api/posts" });
    const read = await call(getPost, { path: `/api/posts/${post.id}`, params: { id: post.id } });

    const counts = Object.fromEntries(
      feed.body.posts.map((p: { id: string; commentCount: number }) => [p.id, p.commentCount]),
    );
    expect(counts).toEqual({ [post.id]: 3, [quiet.id]: 0 });
    expect(read.body.post.commentCount).toBe(3);
  });
});
