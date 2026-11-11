import { describe, expect, it } from "vitest";
import { POST as publishPost } from "@/app/api/posts/[id]/publish/route";
import { GET as getPost, PATCH as patchPost } from "@/app/api/posts/[id]/route";
import { POST as createPost } from "@/app/api/posts/route";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { call } from "../helpers/request";

type Headers = Record<string, string>;

const draft = {
  title: "Notes toward an essay on walking",
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "I walk." }] }] },
};

function publish(id: string, headers: Headers = {}) {
  return call(publishPost, {
    method: "POST",
    path: `/api/posts/${id}/publish`,
    headers,
    params: { id },
  });
}

function read(id: string, headers: Headers = {}) {
  return call(getPost, { path: `/api/posts/${id}`, headers, params: { id } });
}

function edit(id: string, body: unknown, headers: Headers) {
  return call(patchPost, { method: "PATCH", path: `/api/posts/${id}`, body, headers, params: { id } });
}

async function authorWithDraft({ verified = true } = {}) {
  const author = await signedIn({ verified });
  const res = await call(createPost, {
    method: "POST",
    path: "/api/posts",
    body: draft,
    headers: author.headers,
  });
  expect(res.status).toBe(201);
  return { ...author, post: res.body.post };
}

describe("POST /api/posts/:id/publish", () => {
  it("publishes a verified author's draft and sets publishedAt to now", async () => {
    const time = fakeClock(new Date("2026-03-01T09:00:00Z"));
    const { post, headers } = await authorWithDraft();
    time.advance(60_000);

    const res = await publish(post.id, headers);

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({
      id: post.id,
      status: "published",
      publishedAt: "2026-03-01T09:01:00.000Z",
      editedAt: null,
    });
    expect((await read(post.id)).body.post.status).toBe("published");
  });

  it("returns 403 to an unverified author and leaves the post a draft", async () => {
    const { post, headers } = await authorWithDraft({ verified: false });

    const res = await publish(post.id, headers);

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: "FORBIDDEN",
      message: "Verify your email to publish.",
    });
    const row = await db().post.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.publishedAt).toBeNull();
  });

  it("returns 401 when logged out", async () => {
    const { post } = await authorWithDraft();

    expect((await publish(post.id)).status).toBe(401);
  });

  it("returns 404 for someone else's draft, so drafts don't leak", async () => {
    const { post } = await authorWithDraft();
    const stranger = await signedIn({ verified: true });

    const res = await publish(post.id, stranger.headers);

    expect(res.status).toBe(404);
    const row = await db().post.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.publishedAt).toBeNull();
  });

  it("returns 403 for someone else's published post", async () => {
    const { post, headers } = await authorWithDraft();
    await publish(post.id, headers);
    const stranger = await signedIn({ verified: true });

    expect((await publish(post.id, stranger.headers)).status).toBe(403);
  });

  it("returns 404 for a deleted post or an id that isn't a post id", async () => {
    const { post, headers } = await authorWithDraft();
    await db().post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });

    expect((await publish(post.id, headers)).status).toBe(404);
    expect((await publish("not-a-uuid", headers)).status).toBe(404);
  });

  it("never moves publishedAt once set, even when published again", async () => {
    const time = fakeClock(new Date("2026-03-01T09:00:00Z"));
    const { post, headers } = await authorWithDraft();
    const first = await publish(post.id, headers);
    time.advance(24 * 60 * 60_000);

    const again = await publish(post.id, headers);

    expect(again.status).toBe(200);
    expect(again.body.post.publishedAt).toBe(first.body.post.publishedAt);
  });

  it("sets publishedAt once when the same draft is published twice at once", async () => {
    const time = fakeClock(new Date("2026-03-01T09:00:00Z"));
    const { post, headers } = await authorWithDraft();

    const results = await Promise.all([
      publish(post.id, headers),
      (async () => {
        time.advance(5_000);
        return publish(post.id, headers);
      })(),
    ]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const row = await db().post.findUniqueOrThrow({ where: { id: post.id } });
    expect(results.map((r) => r.body.post.publishedAt)).toEqual([
      row.publishedAt!.toISOString(),
      row.publishedAt!.toISOString(),
    ]);
  });
});

describe("editing after publishing", () => {
  it("keeps publishedAt and marks the post edited", async () => {
    const time = fakeClock(new Date("2026-03-01T09:00:00Z"));
    const { post, headers } = await authorWithDraft();
    const published = (await publish(post.id, headers)).body.post;
    time.advance(2 * 60 * 60_000);

    const res = await edit(post.id, { title: "Walking, revised" }, headers);

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({
      title: "Walking, revised",
      status: "published",
      publishedAt: published.publishedAt,
      editedAt: "2026-03-01T11:00:00.000Z",
    });
    expect((await read(post.id)).body.post.editedAt).toBe("2026-03-01T11:00:00.000Z");
  });

  it("doesn't mark a post edited for changes made while it was a draft", async () => {
    const { post, headers } = await authorWithDraft();

    await edit(post.id, { title: "Second draft" }, headers);
    const res = await publish(post.id, headers);

    expect(res.body.post.editedAt).toBeNull();
  });
});

describe("reading time", () => {
  it("is stored with the post and refreshed when the content changes", async () => {
    const { post, headers } = await authorWithDraft();
    expect(post.readingMinutes).toBe(1);
    const long = Array.from({ length: 1000 }, () => "word").join(" ");

    const res = await edit(
      post.id,
      { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: long }] }] } },
      headers,
    );

    expect(res.body.post.readingMinutes).toBe(5);
  });
});
