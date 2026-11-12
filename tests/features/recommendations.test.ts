import { describe, expect, it } from "vitest";
import { PUT as likeRoute } from "@/app/api/posts/[id]/like/route";
import { DELETE as deleteRoute } from "@/app/api/posts/[id]/route";
import { GET as similarRoute } from "@/app/api/posts/[id]/similar/route";
import { GET as recommendationsRoute } from "@/app/api/recommendations/route";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { draftBy, publishedBy, type Author, type CreatedPost } from "../helpers/posts";
import { call } from "../helpers/request";

const DAY = 24 * 60 * 60 * 1000;

type Headers = Record<string, string>;
type Recommended = { posts: { id: string; title: string }[]; basis: string };

function recommendations(headers: Headers = {}) {
  return call(recommendationsRoute, { path: "/api/recommendations", headers });
}

function similar(id: string, headers: Headers = {}) {
  return call(similarRoute, {
    path: `/api/posts/${id}/similar`,
    headers,
    params: { id },
  });
}

async function like(reader: Author, post: CreatedPost) {
  const res = await call(likeRoute, {
    method: "PUT",
    path: `/api/posts/${post.id}/like`,
    headers: reader.headers,
    params: { id: post.id },
  });
  expect(res.status).toBe(200);
}

/** Gives `post` `count` likes from fresh readers. */
async function likedBy(count: number, post: CreatedPost) {
  for (let i = 0; i < count; i++) await like(await signedIn({ verified: true }), post);
}

async function remove(author: Author, post: CreatedPost) {
  const res = await call(deleteRoute, {
    method: "DELETE",
    path: `/api/posts/${post.id}`,
    headers: author.headers,
    params: { id: post.id },
  });
  expect(res.status).toBe(204);
}

const titles = (res: { body: Recommended }) => res.body.posts.map((post) => post.title);

const verified = () => signedIn({ verified: true });

describe("GET /api/recommendations (Recommended for you)", () => {
  it("ranks 5 posts by how much their tags overlap with the posts the reader liked", async () => {
    const time = fakeClock();
    const writer = await verified();
    const reader = await verified();
    await like(reader, await publishedBy(writer, "Liked one", ["writing", "craft"]));
    await like(reader, await publishedBy(writer, "Liked two", ["writing", "habits"]));
    // Weights: writing 2 (both liked posts), craft 1, habits 1.
    const candidates: [string, string[]][] = [
      ["Craft only", ["craft"]],
      ["Writing and craft and habits", ["writing", "craft", "habits"]],
      ["Unrelated", ["cooking"]],
      ["Writing only", ["writing"]],
      ["Writing and craft", ["writing", "craft"]],
      ["Habits only", ["habits"]],
      ["Untagged", []],
    ];
    for (const [title, tags] of candidates) {
      time.advance(60_000);
      await publishedBy(writer, title, tags);
    }

    const res = await recommendations(reader.headers);

    expect(res.status).toBe(200);
    expect(res.body.basis).toBe("liked");
    // Ties on overlap go to the newer post.
    expect(titles(res)).toEqual([
      "Writing and craft and habits",
      "Writing and craft",
      "Writing only",
      "Habits only",
      "Craft only",
    ]);
  });

  it("breaks overlap ties by likes before recency", async () => {
    const time = fakeClock();
    const writer = await verified();
    const reader = await verified();
    await like(reader, await publishedBy(writer, "Liked", ["writing"]));
    const older = await publishedBy(writer, "Older but loved", ["writing"]);
    time.advance(60_000);
    await publishedBy(writer, "Newer", ["writing"]);
    await likedBy(2, older);

    expect(titles(await recommendations(reader.headers))).toEqual(["Older but loved", "Newer"]);
  });

  it("never includes the reader's own posts, posts they liked, drafts or deleted posts", async () => {
    const writer = await verified();
    const reader = await verified();
    await like(reader, await publishedBy(writer, "Liked", ["writing"]));
    await publishedBy(reader, "Mine", ["writing"]);
    await draftBy(writer, "A draft", ["writing"]);
    await remove(writer, await publishedBy(writer, "Deleted", ["writing"]));
    await publishedBy(writer, "Eligible", ["writing"]);

    const res = await recommendations(reader.headers);

    expect(titles(res)).toEqual(["Eligible"]);
  });

  it("fills the rest of the row with popular posts when tag overlap runs out", async () => {
    const writer = await verified();
    const reader = await verified();
    await like(reader, await publishedBy(writer, "Liked", ["writing"]));
    await publishedBy(writer, "Shares a tag", ["writing"]);
    await likedBy(2, await publishedBy(writer, "Popular", ["cooking"]));
    await likedBy(1, await publishedBy(writer, "Less popular", ["travel"]));

    const res = await recommendations(reader.headers);

    expect(res.body.basis).toBe("liked");
    expect(titles(res)).toEqual(["Shares a tag", "Popular", "Less popular"]);
  });

  it("shows the most-liked posts of the last 30 days to a reader with no likes", async () => {
    const time = fakeClock();
    const writer = await verified();
    await likedBy(5, await publishedBy(writer, "Old favourite", ["writing"]));
    time.advance(31 * DAY);
    const posts: CreatedPost[] = [];
    for (let i = 1; i <= 6; i++) {
      time.advance(60_000);
      posts.push(await publishedBy(writer, `Recent ${i}`));
    }
    await likedBy(3, posts[0]);
    await likedBy(2, posts[1]);
    await likedBy(1, posts[2]);
    const reader = await verified();
    await likedBy(4, await publishedBy(reader, "Reader's own"));

    const res = await recommendations(reader.headers);

    expect(res.status).toBe(200);
    expect(res.body.basis).toBe("popular");
    // Most likes first; posts with no likes, newest first.
    expect(titles(res)).toEqual(["Recent 1", "Recent 2", "Recent 3", "Recent 6", "Recent 5"]);
  });

  it("shows the most-liked posts of the last 30 days to logged-out readers", async () => {
    const writer = await verified();
    const quiet = await publishedBy(writer, "Quiet");
    await likedBy(2, await publishedBy(writer, "Loved", ["writing"]));
    await draftBy(writer, "Draft");
    await likedBy(1, quiet);

    const res = await recommendations();

    expect(res.status).toBe(200);
    expect(res.body.basis).toBe("popular");
    expect(titles(res)).toEqual(["Loved", "Quiet"]);
  });

  it("is empty when nothing has been published", async () => {
    const res = await recommendations();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ posts: [], basis: "popular" });
  });

  it("returns cards in the feed's shape", async () => {
    const writer = await verified();
    await publishedBy(writer, "A card", ["writing"]);

    const res = await recommendations();

    expect(res.body.posts[0]).toMatchObject({
      title: "A card",
      tags: ["writing"],
      author: { username: writer.user.username },
      likeCount: 0,
      likedByViewer: false,
      commentCount: 0,
    });
    expect(res.body.posts[0]).not.toHaveProperty("content");
  });
});

describe("GET /api/posts/:id/similar (More like this)", () => {
  it("shows 3 posts that share the most tags, to logged-out readers", async () => {
    const time = fakeClock();
    const writer = await verified();
    const post = await publishedBy(writer, "The post", ["writing", "craft", "habits"]);
    const candidates: [string, string[]][] = [
      ["One shared", ["writing"]],
      ["Three shared", ["writing", "craft", "habits"]],
      ["None shared", ["cooking"]],
      ["Two shared", ["craft", "habits"]],
      ["Another one shared", ["habits", "travel"]],
    ];
    for (const [title, tags] of candidates) {
      time.advance(60_000);
      await publishedBy(writer, title, tags);
    }

    const res = await similar(post.id);

    expect(res.status).toBe(200);
    expect(res.body.basis).toBe("similar");
    expect(titles(res)).toEqual(["Three shared", "Two shared", "Another one shared"]);
  });

  it("leaves out the post itself, drafts and deleted posts", async () => {
    const writer = await verified();
    const post = await publishedBy(writer, "The post", ["writing"]);
    await draftBy(writer, "A draft", ["writing"]);
    await remove(writer, await publishedBy(writer, "Deleted", ["writing"]));
    await publishedBy(writer, "Eligible", ["writing"]);

    expect(titles(await similar(post.id))).toEqual(["Eligible"]);
  });

  it("leaves out the signed-in reader's own posts and posts they liked", async () => {
    const writer = await verified();
    const reader = await verified();
    const post = await publishedBy(writer, "The post", ["writing"]);
    await publishedBy(reader, "Mine", ["writing"]);
    await like(reader, await publishedBy(writer, "Liked", ["writing"]));
    await publishedBy(writer, "Eligible", ["writing"]);

    expect(titles(await similar(post.id, reader.headers))).toEqual(["Eligible"]);
    // Logged out, nothing is the viewer's: the liked post leads on likes.
    expect(titles(await similar(post.id))).toEqual(["Liked", "Eligible", "Mine"]);
  });

  it("falls back to the most-liked posts of the last 30 days for a post with no tags", async () => {
    const time = fakeClock();
    const writer = await verified();
    await likedBy(3, await publishedBy(writer, "Too old"));
    time.advance(31 * DAY);
    const post = await publishedBy(writer, "Untagged post");
    await likedBy(5, post);
    await likedBy(2, await publishedBy(writer, "Popular", ["cooking"]));
    await publishedBy(writer, "Quiet", ["travel"]);

    const res = await similar(post.id);

    expect(res.body.basis).toBe("popular");
    expect(titles(res)).toEqual(["Popular", "Quiet"]);
  });

  it("tops up with popular posts when too few share a tag", async () => {
    const writer = await verified();
    const post = await publishedBy(writer, "The post", ["writing"]);
    await publishedBy(writer, "Shares a tag", ["writing"]);
    await likedBy(1, await publishedBy(writer, "Popular", ["cooking"]));

    const res = await similar(post.id);

    expect(res.body.basis).toBe("similar");
    expect(titles(res)).toEqual(["Shares a tag", "Popular"]);
  });

  it("is 404 for drafts, even to their author, deleted posts and unknown ids", async () => {
    const writer = await verified();
    const draft = await draftBy(writer, "A draft", ["writing"]);
    const deleted = await publishedBy(writer, "Deleted", ["writing"]);
    await remove(writer, deleted);

    for (const [id, headers] of [
      [draft.id, writer.headers],
      [draft.id, {}],
      [deleted.id, {}],
      ["0190d6a4-0000-7000-8000-000000000000", {}],
      ["not-a-uuid", {}],
    ] as const) {
      const res = await similar(id, headers);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    }
  });
});
