import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUT as likeRoute } from "@/app/api/posts/[id]/like/route";
import { POST as publishRoute } from "@/app/api/posts/[id]/publish/route";
import { DELETE as deleteRoute, PATCH as editRoute } from "@/app/api/posts/[id]/route";
import { GET as similarRoute } from "@/app/api/posts/[id]/similar/route";
import { GET as feedRoute } from "@/app/api/posts/route";
import { GET as recommendationsRoute } from "@/app/api/recommendations/route";
import { backgroundTasksSettled } from "@/server/background";
import { clearEmbedding } from "@/server/embeddings/repository";
import { backfillEmbeddings } from "@/server/embeddings/service";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { fakeEmbeddings, hasEmbedding } from "../helpers/embeddings";
import { draftBy, publishedBy, type Author, type CreatedPost } from "../helpers/posts";
import { call } from "../helpers/request";

afterEach(() => {
  vi.restoreAllMocks();
});

type Headers = Record<string, string>;
type Listed = { body: { posts: { title: string }[]; basis: string } };

const verified = () => signedIn({ verified: true });
const titles = (res: Listed) => res.body.posts.map((post) => post.title);

/** Publishes and waits for the embedding job the publish started. */
async function published(author: Author, title: string, tags: string[] = []) {
  const post = await publishedBy(author, title, tags);
  await backgroundTasksSettled();
  return post;
}

function publish(author: Author, post: CreatedPost) {
  return call(publishRoute, {
    method: "POST",
    path: `/api/posts/${post.id}/publish`,
    headers: author.headers,
    params: { id: post.id },
  });
}

async function edit(author: Author, post: CreatedPost, body: Record<string, unknown>) {
  const res = await call(editRoute, {
    method: "PATCH",
    path: `/api/posts/${post.id}`,
    body,
    headers: author.headers,
    params: { id: post.id },
  });
  expect(res.status).toBe(200);
  await backgroundTasksSettled();
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

async function remove(author: Author, post: CreatedPost) {
  const res = await call(deleteRoute, {
    method: "DELETE",
    path: `/api/posts/${post.id}`,
    headers: author.headers,
    params: { id: post.id },
  });
  expect(res.status).toBe(204);
}

function recommendations(headers: Headers = {}) {
  return call(recommendationsRoute, { path: "/api/recommendations", headers });
}

function similar(post: CreatedPost, headers: Headers = {}) {
  return call(similarRoute, {
    path: `/api/posts/${post.id}/similar`,
    headers,
    params: { id: post.id },
  });
}

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("embedding posts when they are saved", () => {
  it("embeds a post's title, description and tags once it is published", async () => {
    const ai = fakeEmbeddings();
    const writer = await verified();
    const draft = await draftBy(writer, "Baking sourdough", ["baking", "bread"]);
    await edit(writer, draft, { description: "Flour, water and patience." });
    expect(ai.embedded).toEqual([]);
    expect(await hasEmbedding(draft.id)).toBe(false);

    expect((await publish(writer, draft)).status).toBe(200);
    await backgroundTasksSettled();

    expect(ai.embedded).toEqual(["Baking sourdough\nFlour, water and patience.\n#baking #bread"]);
    expect(await hasEmbedding(draft.id)).toBe(true);
  });

  it("publishes even when the embedding provider fails", async () => {
    const ai = fakeEmbeddings();
    ai.fail();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const writer = await verified();
    const draft = await draftBy(writer, "Published anyway");

    const res = await publish(writer, draft);
    await backgroundTasksSettled();

    expect(res.status).toBe(200);
    expect(res.body.post.status).toBe("published");
    expect(titles(await call(feedRoute, { path: "/api/posts" }))).toEqual(["Published anyway"]);
    expect(await hasEmbedding(draft.id)).toBe(false);
    expect(logged).toHaveBeenCalled();
  });

  it("answers the publish before a slow embedding finishes", async () => {
    const ai = fakeEmbeddings();
    const release = ai.hold();
    const writer = await verified();
    const draft = await draftBy(writer, "Slow to embed");

    try {
      // The provider can't answer until released, yet the publish is done.
      const res = await publish(writer, draft);
      expect(res.status).toBe(200);
      expect(res.body.post.status).toBe("published");
      expect(await hasEmbedding(draft.id)).toBe(false);
    } finally {
      release();
    }

    await backgroundTasksSettled();
    expect(ai.embedded).toEqual(["Slow to embed"]);
    expect(await hasEmbedding(draft.id)).toBe(true);
  });

  it("doesn't re-embed when publishing an already published post again", async () => {
    const ai = fakeEmbeddings();
    const writer = await verified();
    const post = await published(writer, "Published once");

    expect((await publish(writer, post)).status).toBe(200);
    await backgroundTasksSettled();

    expect(ai.embedded).toEqual(["Published once"]);
  });

  it("doesn't re-embed for edits to the content or cover alone", async () => {
    const ai = fakeEmbeddings();
    const writer = await verified();
    const post = await published(writer, "Steady title", ["writing"]);

    await edit(writer, post, { content: paragraph("A completely new body.") });
    await edit(writer, post, { coverUrl: null });
    await edit(writer, post, { title: "Steady title", tags: ["writing"] });

    expect(ai.embedded).toEqual(["Steady title\n#writing"]);
    expect(await hasEmbedding(post.id)).toBe(true);
  });

  it("re-embeds when the title, description or tags change", async () => {
    const ai = fakeEmbeddings();
    const writer = await verified();
    const post = await published(writer, "First title", ["writing"]);

    await edit(writer, post, { title: "Second title" });
    await edit(writer, post, { description: "Now with a description." });
    await edit(writer, post, { tags: ["writing", "craft"] });
    await edit(writer, post, { content: paragraph("Content changes don't count.") });

    expect(ai.embedded).toEqual([
      "First title\n#writing",
      "Second title\n#writing",
      "Second title\nNow with a description.\n#writing",
      "Second title\nNow with a description.\n#writing #craft",
    ]);
    expect(await hasEmbedding(post.id)).toBe(true);
  });

  it("drops a stale vector when re-embedding fails, and still saves the edit", async () => {
    const ai = fakeEmbeddings();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const writer = await verified();
    const post = await published(writer, "Before");
    ai.fail();

    await edit(writer, post, { title: "After" });

    expect(await hasEmbedding(post.id)).toBe(false);
    expect(titles(await call(feedRoute, { path: "/api/posts" }))).toEqual(["After"]);
  });

  it("doesn't embed drafts, even when their title changes", async () => {
    const ai = fakeEmbeddings();
    const writer = await verified();
    const draft = await draftBy(writer, "A draft");

    await edit(writer, draft, { title: "Still a draft", tags: ["writing"] });

    expect(ai.embedded).toEqual([]);
  });

  it("embeds nothing when no AI key is set", async () => {
    const writer = await verified();

    const post = await published(writer, "No AI here");

    expect(await hasEmbedding(post.id)).toBe(false);
  });
});

describe("recommendations by meaning", () => {
  beforeEach(() => {
    fakeEmbeddings();
  });

  it("picks the posts closest in meaning for More like this, logged out too", async () => {
    const writer = await verified();
    const post = await published(writer, "Sourdough bread baking");
    await published(writer, "Bread crust tips");
    await published(writer, "Kubernetes clusters");
    await published(writer, "Baking sourdough bread at home");
    await published(writer, "Sourdough starters");

    const res = await similar(post);

    expect(res.status).toBe(200);
    expect(res.body.basis).toBe("similar");
    // Shares 3 words, then 1 of 2, then 1 of 3; "Kubernetes clusters" shares none.
    expect(titles(res)).toEqual([
      "Baking sourdough bread at home",
      "Sourdough starters",
      "Bread crust tips",
    ]);
  });

  it("recommends posts like the average of the ones the reader liked", async () => {
    const writer = await verified();
    const reader = await verified();
    await like(reader, await published(writer, "Sourdough bread"));
    await like(reader, await published(writer, "Hiking mountains"));
    await published(writer, "Sourdough bread and hiking mountains");
    await published(writer, "Sourdough loaves");
    await published(writer, "Mountains in winter");
    await published(writer, "Tax returns explained");

    const res = await recommendations(reader.headers);

    expect(res.body.basis).toBe("liked");
    expect(titles(res).slice(0, 3)).toEqual([
      "Sourdough bread and hiking mountains",
      "Sourdough loaves",
      "Mountains in winter",
    ]);
  });

  it("never includes the reader's own posts, posts they liked, drafts or deleted posts", async () => {
    const writer = await verified();
    const reader = await verified();
    const liked = await published(writer, "Garden tomatoes");
    await like(reader, liked);
    await published(reader, "Garden tomatoes of mine");
    await draftBy(writer, "Garden tomatoes draft");
    await remove(writer, await published(writer, "Garden tomatoes deleted"));
    await published(writer, "Garden tomatoes eligible");

    expect(titles(await recommendations(reader.headers))).toEqual(["Garden tomatoes eligible"]);
    expect(titles(await similar(liked, reader.headers))).toEqual(["Garden tomatoes eligible"]);
  });

  it("shows 5 posts for the reader and 3 for a post", async () => {
    const time = fakeClock();
    const writer = await verified();
    const reader = await verified();
    const post = await published(writer, "Coffee brewing");
    await like(reader, post);
    for (let i = 1; i <= 7; i++) {
      time.advance(60_000);
      await published(writer, `Coffee brewing note ${i}`);
    }

    expect(titles(await recommendations(reader.headers))).toHaveLength(5);
    expect(titles(await similar(post))).toHaveLength(3);
  });

  it("falls back to tag overlap for a post that isn't embedded yet", async () => {
    const writer = await verified();
    const post = await published(writer, "Waiting for its vector", ["chess"]);
    await published(writer, "Shares the tag", ["chess"]);
    await published(writer, "Waiting for its vector too");
    await clearEmbedding(post.id);

    const res = await similar(post);

    expect(res.body.basis).toBe("similar");
    expect(titles(res)[0]).toBe("Shares the tag");
  });

  it("falls back to the popular posts when nothing has a vector to go on", async () => {
    const writer = await verified();
    const reader = await verified();

    expect((await recommendations(reader.headers)).body.basis).toBe("popular");
    await published(writer, "Alone");
    expect((await recommendations()).body).toMatchObject({ basis: "popular" });
  });
});

describe("backfilling embeddings", () => {
  it("embeds only published posts that are missing a vector", async () => {
    const ai = fakeEmbeddings();
    const writer = await verified();
    const embedded = await published(writer, "Already embedded");
    const cleared = await published(writer, "Cleared");
    await clearEmbedding(cleared.id);
    const draft = await draftBy(writer, "A draft");
    const deleted = await published(writer, "Deleted");
    await clearEmbedding(deleted.id);
    await remove(writer, deleted);
    ai.fail();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failedAtSave = await published(writer, "Failed at save");
    ai.recover();
    ai.embedded.length = 0;

    const result = await backfillEmbeddings(ai.provider);

    expect(result).toEqual({ embedded: 2, failed: 0 });
    expect(ai.embedded).toEqual(["Cleared", "Failed at save"]);
    expect(await hasEmbedding(embedded.id)).toBe(true);
    expect(await hasEmbedding(cleared.id)).toBe(true);
    expect(await hasEmbedding(failedAtSave.id)).toBe(true);
    expect(await hasEmbedding(draft.id)).toBe(false);
    expect(await hasEmbedding(deleted.id)).toBe(false);

    // Running it again finds nothing left to do.
    expect(await backfillEmbeddings(ai.provider)).toEqual({ embedded: 0, failed: 0 });
  });

  it("keeps going past posts that fail, and reports them", async () => {
    const ai = fakeEmbeddings();
    const writer = await verified();
    const first = await published(writer, "First");
    const second = await published(writer, "Second");
    await clearEmbedding(first.id);
    await clearEmbedding(second.id);
    const failing = {
      embed: (text: string) =>
        text === "First" ? Promise.reject(new Error("quota")) : ai.provider.embed(text),
    };
    const log = vi.fn();

    const result = await backfillEmbeddings(failing, log);

    expect(result).toEqual({ embedded: 1, failed: 1 });
    expect(await hasEmbedding(first.id)).toBe(false);
    expect(await hasEmbedding(second.id)).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("quota"));
  });
});
