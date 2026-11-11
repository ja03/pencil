import { describe, expect, it } from "vitest";
import { GET as authorPosts } from "@/app/api/users/[username]/posts/route";
import { GET as authorProfile } from "@/app/api/users/[username]/route";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { draftBy, publishedBy, type Author } from "../helpers/posts";
import { call } from "../helpers/request";

function profile(username: string) {
  return call(authorProfile, { path: `/api/users/${username}`, params: { username } });
}

function posts(username: string, cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return call(authorPosts, { path: `/api/users/${username}/posts${query}`, params: { username } });
}

const titles = (list: { title: string }[]) => list.map((p) => p.title);

/** Publishes `count` posts by `author`, one a minute apart. */
async function publishMany(author: Author, count: number) {
  const time = fakeClock();
  for (let i = 1; i <= count; i++) {
    time.advance(60_000);
    await publishedBy(author, `Post ${i}`);
  }
}

describe("GET /api/users/:username", () => {
  it("shows an author's public profile to logged-out readers", async () => {
    const lina = await signedIn({ username: "lina_k", verified: true });
    await publishedBy(lina, "One");
    await publishedBy(lina, "Two");
    await draftBy(lina, "Not yet");

    const res = await profile("lina_k");

    expect(res.status).toBe(200);
    expect(res.body.profile).toEqual({
      username: "lina_k",
      publishedCount: 2,
      joinedAt: lina.user.createdAt.toISOString(),
    });
  });

  it("never exposes the author's email or id", async () => {
    await signedIn({ username: "lina_k" });

    const res = await profile("lina_k");

    expect(JSON.stringify(res.body)).not.toContain("@example.com");
    expect(res.body.profile).not.toHaveProperty("id");
    expect(res.body.profile).not.toHaveProperty("email");
  });

  it("finds the author whatever the case of the username in the URL", async () => {
    await signedIn({ username: "lina_k" });

    const res = await profile("Lina_K");

    expect(res.status).toBe(200);
    expect(res.body.profile.username).toBe("lina_k");
  });

  it("returns 404 for a username nobody has", async () => {
    const res = await profile("nobody_here");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for something that can't be a username", async () => {
    expect((await profile("no spaces!")).status).toBe(404);
  });
});

describe("GET /api/users/:username/posts", () => {
  it("lists only the author's published posts, newest first", async () => {
    const lina = await signedIn({ username: "lina_k", verified: true });
    const omar = await signedIn({ username: "omar", verified: true });
    const time = fakeClock();
    await publishedBy(lina, "Older");
    time.advance(60_000);
    await publishedBy(omar, "Someone else's");
    time.advance(60_000);
    await publishedBy(lina, "Newer");
    await draftBy(lina, "A draft");

    const res = await posts("lina_k");

    expect(res.status).toBe(200);
    expect(titles(res.body.posts)).toEqual(["Newer", "Older"]);
    expect(res.body.posts[0].author).toEqual({ id: lina.user.id, username: "lina_k" });
    expect(res.body.nextCursor).toBeNull();
  });

  it("pages 10 at a time by cursor", async () => {
    const lina = await signedIn({ username: "lina_k", verified: true });
    await publishMany(lina, 12);

    const first = await posts("lina_k");
    const second = await posts("lina_k", first.body.nextCursor);

    expect(titles(first.body.posts)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `Post ${n}`));
    expect(titles(second.body.posts)).toEqual(["Post 2", "Post 1"]);
    expect(second.body.nextCursor).toBeNull();
  });

  it("returns an empty first page for an author who hasn't published", async () => {
    const lina = await signedIn({ username: "lina_k" });
    await draftBy(lina, "Hidden");

    const res = await posts("lina_k");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ posts: [], nextCursor: null });
  });

  it("returns 404 for a username nobody has", async () => {
    expect((await posts("nobody_here")).status).toBe(404);
  });

  it("rejects a cursor it didn't issue with 400", async () => {
    await signedIn({ username: "lina_k" });

    const res = await posts("lina_k", "garbage");

    expect(res.status).toBe(400);
  });
});
