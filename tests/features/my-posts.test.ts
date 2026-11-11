import { describe, expect, it } from "vitest";
import { GET as myPosts } from "@/app/api/me/posts/route";
import { PATCH as patchPost } from "@/app/api/posts/[id]/route";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { draftBy, publishedBy } from "../helpers/posts";
import { call } from "../helpers/request";

function list(headers: Record<string, string> = {}) {
  return call(myPosts, { path: "/api/me/posts", headers });
}

describe("GET /api/me/posts", () => {
  it("lists the owner's drafts and published posts, most recently updated first", async () => {
    const author = await signedIn({ verified: true });
    const time = fakeClock();
    const published = await publishedBy(author, "Out in the world");
    time.advance(60_000);
    const draft = await draftBy(author, "Still working");
    time.advance(60_000);
    await call(patchPost, {
      method: "PATCH",
      path: `/api/posts/${published.id}`,
      body: { title: "Out in the world, revised" },
      headers: author.headers,
      params: { id: published.id },
    });

    const res = await list(author.headers);

    expect(res.status).toBe(200);
    expect(res.body.posts).toEqual([
      expect.objectContaining({
        id: published.id,
        slug: published.slug,
        title: "Out in the world, revised",
        status: "published",
        publishedAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
      expect.objectContaining({
        id: draft.id,
        title: "Still working",
        status: "draft",
        publishedAt: null,
      }),
    ]);
  });

  it("shows each owner only their own posts", async () => {
    const lina = await signedIn({ verified: true });
    const omar = await signedIn({ verified: true });
    const linas = await draftBy(lina, "Lina's draft");
    await draftBy(omar, "Omar's draft");
    await publishedBy(omar, "Omar's post");

    const res = await list(lina.headers);

    expect(res.body.posts.map((p: { id: string }) => p.id)).toEqual([linas.id]);
  });

  it("returns an empty list for an author with no posts", async () => {
    const author = await signedIn();

    const res = await list(author.headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ posts: [] });
  });

  it("returns 401 when logged out", async () => {
    const res = await list();

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
