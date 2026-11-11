import { describe, expect, it } from "vitest";
import { GET as myPosts } from "@/app/api/me/posts/route";
import { DELETE as deletePost, GET as getPost, PATCH as patchPost } from "@/app/api/posts/[id]/route";
import { POST as publishPost } from "@/app/api/posts/[id]/publish/route";
import { GET as feed } from "@/app/api/posts/route";
import { GET as tagPosts } from "@/app/api/tags/[tag]/posts/route";
import { GET as suggestTags } from "@/app/api/tags/route";
import { GET as authorPosts } from "@/app/api/users/[username]/posts/route";
import { GET as authorProfile } from "@/app/api/users/[username]/route";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { draftBy, publishedBy } from "../helpers/posts";
import { call } from "../helpers/request";

type Headers = Record<string, string>;

function remove(id: string, headers: Headers = {}) {
  return call(deletePost, { method: "DELETE", path: `/api/posts/${id}`, headers, params: { id } });
}

const ids = (posts: { id: string }[]) => posts.map((p) => p.id);

describe("DELETE /api/posts/:id", () => {
  it("removes a published post from its URL, the feed, the profile, tag pages and My posts", async () => {
    const author = await signedIn({ verified: true });
    const kept = await publishedBy(author, "Kept", ["walking"]);
    const gone = await publishedBy(author, "Gone", ["walking"]);
    const { username } = author.user;

    const res = await remove(gone.id, author.headers);

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect((await call(getPost, { path: `/api/posts/${gone.id}`, params: { id: gone.id } })).status).toBe(404);
    expect(ids((await call(feed, { path: "/api/posts" })).body.posts)).toEqual([kept.id]);
    expect(
      ids((await call(tagPosts, { path: "/api/tags/walking/posts", params: { tag: "walking" } })).body.posts),
    ).toEqual([kept.id]);
    expect(
      ids((await call(authorPosts, { path: `/api/users/${username}/posts`, params: { username } })).body.posts),
    ).toEqual([kept.id]);
    expect(
      (await call(authorProfile, { path: `/api/users/${username}`, params: { username } })).body.profile
        .publishedCount,
    ).toBe(1);
    expect(ids((await call(myPosts, { path: "/api/me/posts", headers: author.headers })).body.posts)).toEqual([
      kept.id,
    ]);
  });

  it("soft-deletes: the row stays, with deletedAt set", async () => {
    const author = await signedIn({ verified: true });
    const post = await publishedBy(author, "Soft");

    await remove(post.id, author.headers);

    const row = await db().post.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(row.title).toBe("Soft");
  });

  it("drops a deleted post's tags from tag suggestions", async () => {
    const author = await signedIn({ verified: true });
    const post = await publishedBy(author, "Only one", ["solitary"]);

    await remove(post.id, author.headers);

    const res = await call(suggestTags, { path: "/api/tags?q=sol" });
    expect(res.body.tags).toEqual([]);
  });

  it("lets the author delete a draft, even when unverified", async () => {
    const author = await signedIn({ verified: false });
    const post = await draftBy(author, "Unfinished");

    const res = await remove(post.id, author.headers);

    expect(res.status).toBe(204);
    expect(
      (await call(getPost, { path: `/api/posts/${post.id}`, headers: author.headers, params: { id: post.id } }))
        .status,
    ).toBe(404);
  });

  it("returns 404 for a post that is already deleted, so it can't be edited or published again", async () => {
    const author = await signedIn({ verified: true });
    const post = await draftBy(author, "Twice");
    await remove(post.id, author.headers);

    expect((await remove(post.id, author.headers)).status).toBe(404);
    const edit = await call(patchPost, {
      method: "PATCH",
      path: `/api/posts/${post.id}`,
      body: { title: "Back" },
      headers: author.headers,
      params: { id: post.id },
    });
    expect(edit.status).toBe(404);
    const publish = await call(publishPost, {
      method: "POST",
      path: `/api/posts/${post.id}/publish`,
      headers: author.headers,
      params: { id: post.id },
    });
    expect(publish.status).toBe(404);
  });

  it("returns 403 to another user deleting a published post and leaves it in place", async () => {
    const author = await signedIn({ verified: true });
    const stranger = await signedIn({ verified: true });
    const post = await publishedBy(author, "Mine");

    const res = await remove(post.id, stranger.headers);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(ids((await call(feed, { path: "/api/posts" })).body.posts)).toEqual([post.id]);
    expect((await db().post.findUniqueOrThrow({ where: { id: post.id } })).deletedAt).toBeNull();
  });

  it("returns 404 to another user deleting a draft, the same as for a missing post", async () => {
    const author = await signedIn();
    const stranger = await signedIn();
    const post = await draftBy(author, "Private");

    const res = await remove(post.id, stranger.headers);

    expect(res.status).toBe(404);
    expect((await db().post.findUniqueOrThrow({ where: { id: post.id } })).deletedAt).toBeNull();
  });

  it("returns 401 when logged out", async () => {
    const author = await signedIn({ verified: true });
    const post = await publishedBy(author, "Mine");

    const res = await remove(post.id);

    expect(res.status).toBe(401);
    expect((await db().post.findUniqueOrThrow({ where: { id: post.id } })).deletedAt).toBeNull();
  });

  it("returns 404 for an id that isn't a post id", async () => {
    const author = await signedIn();

    expect((await remove("not-a-uuid", author.headers)).status).toBe(404);
  });
});
