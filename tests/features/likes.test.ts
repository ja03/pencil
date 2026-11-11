import { describe, expect, it } from "vitest";
import { DELETE as unlikeRoute, PUT as likeRoute } from "@/app/api/posts/[id]/like/route";
import { GET as getPost } from "@/app/api/posts/[id]/route";
import { GET as getFeed } from "@/app/api/posts/route";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { draftBy, publishedBy } from "../helpers/posts";
import { call } from "../helpers/request";

type Headers = Record<string, string>;

function like(id: string, headers: Headers = {}) {
  return call(likeRoute, { method: "PUT", path: `/api/posts/${id}/like`, headers, params: { id } });
}

function unlike(id: string, headers: Headers = {}) {
  return call(unlikeRoute, {
    method: "DELETE",
    path: `/api/posts/${id}/like`,
    headers,
    params: { id },
  });
}

function read(id: string, headers: Headers = {}) {
  return call(getPost, { path: `/api/posts/${id}`, headers, params: { id } });
}

const likeRows = (postId: string) => db().like.count({ where: { postId } });

async function aPublishedPost() {
  const author = await signedIn({ verified: true });
  return { author, post: await publishedBy(author, "On walking") };
}

describe("PUT /api/posts/:id/like", () => {
  it("likes a published post and returns the new count", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });

    const res = await like(post.id, reader.headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: true, likeCount: 1 });
    expect(await likeRows(post.id)).toBe(1);
  });

  it("counts likes from different readers", async () => {
    const { post } = await aPublishedPost();
    const first = await signedIn({ verified: true });
    const second = await signedIn({ verified: true });

    await like(post.id, first.headers);
    const res = await like(post.id, second.headers);

    expect(res.body).toEqual({ liked: true, likeCount: 2 });
  });

  it("is a no-op when the reader already likes the post", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    await like(post.id, reader.headers);

    const res = await like(post.id, reader.headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: true, likeCount: 1 });
    expect(await likeRows(post.id)).toBe(1);
  });

  it("records exactly one like when the same reader sends many at once", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });

    const responses = await Promise.all(
      Array.from({ length: 8 }, () => like(post.id, reader.headers)),
    );

    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
    for (const res of responses) expect(res.body).toEqual({ liked: true, likeCount: 1 });
    expect(await likeRows(post.id)).toBe(1);
  });

  it("lets authors like their own posts", async () => {
    const { author, post } = await aPublishedPost();

    const res = await like(post.id, author.headers);

    expect(res.body).toEqual({ liked: true, likeCount: 1 });
  });

  it("returns 403 to an unverified reader and records nothing", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: false });

    const res = await like(post.id, reader.headers);

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: "FORBIDDEN",
      message: "Verify your email to like posts.",
    });
    expect(await likeRows(post.id)).toBe(0);
  });

  it("returns 401 when logged out", async () => {
    const { post } = await aPublishedPost();

    const res = await like(post.id);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 404 for a draft, a deleted post or an unknown id", async () => {
    const author = await signedIn({ verified: true });
    const draft = await draftBy(author, "Not yet");
    const { post: deleted } = await aPublishedPost();
    await db().post.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    for (const id of [draft.id, deleted.id, "00000000-0000-7000-8000-000000000000", "nope"]) {
      const res = await like(id, author.headers);
      expect(res.status, id).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    expect(await db().like.count()).toBe(0);
  });
});

describe("DELETE /api/posts/:id/like", () => {
  it("unlikes a post and returns the new count", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    const other = await signedIn({ verified: true });
    await like(post.id, reader.headers);
    await like(post.id, other.headers);

    const res = await unlike(post.id, reader.headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: false, likeCount: 1 });
    expect(await likeRows(post.id)).toBe(1);
  });

  it("toggles back on after unliking", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    await like(post.id, reader.headers);
    await unlike(post.id, reader.headers);

    const res = await like(post.id, reader.headers);

    expect(res.body).toEqual({ liked: true, likeCount: 1 });
  });

  it("is a no-op when the reader doesn't like the post", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });

    const res = await unlike(post.id, reader.headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: false, likeCount: 0 });
  });

  it("returns 403 to an unverified reader", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: false });

    const res = await unlike(post.id, reader.headers);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when logged out", async () => {
    const { post } = await aPublishedPost();

    const res = await unlike(post.id);

    expect(res.status).toBe(401);
  });

  it("returns 404 for a deleted post", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    await like(post.id, reader.headers);
    await db().post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });

    const res = await unlike(post.id, reader.headers);

    expect(res.status).toBe(404);
  });
});

describe("like counts on posts", () => {
  it("shows the count on feed cards", async () => {
    const { post } = await aPublishedPost();
    const reader = await signedIn({ verified: true });
    await like(post.id, reader.headers);

    const res = await call(getFeed, { path: "/api/posts" });

    expect(res.body.posts[0]).toMatchObject({ id: post.id, likeCount: 1 });
  });

  it("shows the count on the post, and whether the viewer likes it", async () => {
    const { post } = await aPublishedPost();
    const fan = await signedIn({ verified: true });
    const passerby = await signedIn({ verified: true });
    await like(post.id, fan.headers);

    expect((await read(post.id, fan.headers)).body.post).toMatchObject({
      likeCount: 1,
      likedByViewer: true,
    });
    expect((await read(post.id, passerby.headers)).body.post).toMatchObject({
      likeCount: 1,
      likedByViewer: false,
    });
    expect((await read(post.id)).body.post).toMatchObject({
      likeCount: 1,
      likedByViewer: false,
    });
  });
});
