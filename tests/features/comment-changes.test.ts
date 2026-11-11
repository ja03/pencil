import { beforeEach, describe, expect, it } from "vitest";
import { DELETE as deleteRoute, PATCH as editRoute } from "@/app/api/comments/[id]/route";
import { GET as listRoute, POST as createRoute } from "@/app/api/posts/[id]/comments/route";
import { GET as getPost } from "@/app/api/posts/[id]/route";
import { GET as getFeed } from "@/app/api/posts/route";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { publishedBy, type Author } from "../helpers/posts";
import { call } from "../helpers/request";

const UNKNOWN_ID = "00000000-0000-7000-8000-000000000000";

type Headers = Record<string, string>;
type Listed = { id: string; deleted: boolean; replies: { id: string }[] };

let ip = 0;
/** A different client IP for each comment, so the rate limit stays out of the way. */
const freshIp = () => ({ "x-forwarded-for": `198.51.100.${(ip = (ip + 1) % 250)}` });

/** Posts `body` as `author` and returns the new comment's id. */
async function commentBy(author: Author, postId: string, body: string, parentId?: string) {
  const res = await call(createRoute, {
    method: "POST",
    path: `/api/posts/${postId}/comments`,
    headers: { ...freshIp(), ...author.headers },
    body: { body, parentId },
    params: { id: postId },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.comment.id as string;
}

function edit(id: string, headers: Headers, body: unknown) {
  return call(editRoute, {
    method: "PATCH",
    path: `/api/comments/${id}`,
    headers,
    body,
    params: { id },
  });
}

function remove(id: string, headers: Headers) {
  return call(deleteRoute, {
    method: "DELETE",
    path: `/api/comments/${id}`,
    headers,
    params: { id },
  });
}

function list(postId: string, cursor?: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return call(listRoute, { path: `/api/posts/${postId}/comments${query}`, params: { id: postId } });
}

/** The thread a reader sees: top-level ids, each with its reply ids. */
async function shape(postId: string) {
  const res = await list(postId);
  expect(res.status).toBe(200);
  return (res.body.comments as Listed[]).map((c) => [c.id, c.replies.map((r) => r.id)]);
}

/** The comment count on the post itself and on its feed card. */
async function counts(postId: string) {
  const read = await call(getPost, { path: `/api/posts/${postId}`, params: { id: postId } });
  const feed = await call(getFeed, { path: "/api/posts" });
  const card = feed.body.posts.find((p: { id: string }) => p.id === postId);
  return { post: read.body.post.commentCount, card: card.commentCount };
}

let time: ReturnType<typeof fakeClock>;

beforeEach(() => {
  time = fakeClock();
});

/** A published post by its own author, and a verified reader to comment on it. */
async function aConversation() {
  const author = await signedIn({ verified: true });
  const post = await publishedBy(author, "On walking");
  const reader = await signedIn({ verified: true });
  return { author, post, reader };
}

describe("PATCH /api/comments/:id", () => {
  it("lets the commenter change the text and marks the comment edited", async () => {
    const { post, reader } = await aConversation();
    const id = await commentBy(reader, post.id, "Lovley piece.");
    time.advance(60_000);

    const res = await edit(id, reader.headers, { body: "  Lovely piece.  " });

    expect(res.status).toBe(200);
    expect(res.body.comment).toEqual({
      id,
      parentId: null,
      body: "Lovely piece.",
      createdAt: "2026-01-01T00:00:00.000Z",
      editedAt: "2026-01-01T00:01:00.000Z",
      author: { id: reader.user.id, username: reader.user.username },
      deleted: false,
    });
    const listed = (await list(post.id)).body.comments[0];
    expect(listed).toMatchObject({ body: "Lovely piece.", editedAt: "2026-01-01T00:01:00.000Z" });
  });

  it("edits a reply in place", async () => {
    const { post, reader, author } = await aConversation();
    const top = await commentBy(author, post.id, "Thanks for reading.");
    const reply = await commentBy(reader, post.id, "Anytime", top);

    const res = await edit(reply, reader.headers, { body: "Anytime!" });

    expect(res.status).toBe(200);
    expect(res.body.comment).toMatchObject({ parentId: top, body: "Anytime!" });
    const [thread] = (await list(post.id)).body.comments;
    expect(thread.replies[0]).toMatchObject({
      id: reply,
      body: "Anytime!",
      editedAt: expect.any(String),
    });
  });

  it("doesn't mark a comment edited when the text is unchanged", async () => {
    const { post, reader } = await aConversation();
    const id = await commentBy(reader, post.id, "Same words");

    const res = await edit(id, reader.headers, { body: " Same words " });

    expect(res.status).toBe(200);
    expect(res.body.comment.editedAt).toBeNull();
  });

  it("returns 403 to anyone but the commenter, the post's author included", async () => {
    const { author, post, reader } = await aConversation();
    const stranger = await signedIn({ verified: true });
    const id = await commentBy(reader, post.id, "Mine");

    for (const someone of [author, stranger]) {
      const res = await edit(id, someone.headers, { body: "Theirs" });
      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({
        code: "FORBIDDEN",
        message: "Only the person who wrote a comment can edit it.",
      });
    }
    const row = await db().comment.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ body: "Mine", editedAt: null });
  });

  it("returns 401 when logged out", async () => {
    const { post, reader } = await aConversation();
    const id = await commentBy(reader, post.id, "Mine");

    const res = await edit(id, {}, { body: "Theirs" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("checks the new text like a new comment", async () => {
    const { post, reader } = await aConversation();
    const id = await commentBy(reader, post.id, "Mine");

    const empty = await edit(id, reader.headers, { body: "   " });
    const tooLong = await edit(id, reader.headers, { body: "a".repeat(1001) });

    expect(empty.status).toBe(400);
    expect(empty.body.error.fields).toEqual({ body: ["Write something first."] });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.fields).toEqual({ body: ["Keep comments to 1,000 characters."] });
  });

  it("returns 404 for a deleted comment, a comment on a deleted post, or an unknown id", async () => {
    const { post, reader } = await aConversation();
    const deleted = await commentBy(reader, post.id, "Gone");
    expect((await remove(deleted, reader.headers)).status).toBe(204);
    const other = await aConversation();
    const onDeletedPost = await commentBy(reader, other.post.id, "Also gone");
    await db().post.update({ where: { id: other.post.id }, data: { deletedAt: new Date() } });

    for (const id of [deleted, onDeletedPost, UNKNOWN_ID, "nope"]) {
      const res = await edit(id, reader.headers, { body: "Back" });
      expect(res.status, id).toBe(404);
      expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "That comment doesn't exist." });
    }
  });
});

describe("DELETE /api/comments/:id", () => {
  it("lets the commenter delete a comment with no replies, which then disappears", async () => {
    const { post, reader } = await aConversation();
    const keep = await commentBy(reader, post.id, "Keep");
    const id = await commentBy(reader, post.id, "Take back");

    const res = await remove(id, reader.headers);

    expect(res.status).toBe(204);
    expect(await shape(post.id)).toEqual([[keep, []]]);
    expect(await counts(post.id)).toEqual({ post: 1, card: 1 });
  });

  it("lets the post's author delete anyone's comment on their post", async () => {
    const { author, post, reader } = await aConversation();
    const id = await commentBy(reader, post.id, "Rude");

    const res = await remove(id, author.headers);

    expect(res.status).toBe(204);
    expect(await shape(post.id)).toEqual([]);
  });

  it("returns 403 to anyone else and keeps the comment", async () => {
    const { post, reader } = await aConversation();
    const stranger = await signedIn({ verified: true });
    const id = await commentBy(reader, post.id, "Mine");

    const res = await remove(id, stranger.headers);

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: "FORBIDDEN",
      message: "Only the commenter or the post's author can delete this comment.",
    });
    expect(await shape(post.id)).toEqual([[id, []]]);
  });

  it("returns 401 when logged out", async () => {
    const { post, reader } = await aConversation();
    const id = await commentBy(reader, post.id, "Mine");

    const res = await remove(id, {});

    expect(res.status).toBe(401);
    expect(await shape(post.id)).toEqual([[id, []]]);
  });

  it("returns 404 for a comment that is already deleted or doesn't exist", async () => {
    const { post, reader } = await aConversation();
    const id = await commentBy(reader, post.id, "Once");
    await remove(id, reader.headers);

    for (const target of [id, UNKNOWN_ID, "nope"]) {
      const res = await remove(target, reader.headers);
      expect(res.status, target).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("leaves a placeholder for a comment with replies, and keeps the replies readable", async () => {
    const { author, post, reader } = await aConversation();
    const top = await commentBy(reader, post.id, "Hot take");
    time.advance(1000);
    const reply = await commentBy(author, post.id, "I disagree", top);

    const res = await remove(top, reader.headers);

    expect(res.status).toBe(204);
    const [thread] = (await list(post.id)).body.comments;
    expect(thread).toEqual({
      id: top,
      parentId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      deleted: true,
      replies: [expect.objectContaining({ id: reply, body: "I disagree", deleted: false })],
    });
    // Soft delete: the row stays, so its replies keep their parent.
    const row = await db().comment.findUniqueOrThrow({ where: { id: top } });
    expect(row.deletedAt).toEqual(new Date("2026-01-01T00:00:01.000Z"));
    expect(await counts(post.id)).toEqual({ post: 1, card: 1 });
  });

  it("removes a deleted reply from its thread", async () => {
    const { post, reader } = await aConversation();
    const top = await commentBy(reader, post.id, "Top");
    const first = await commentBy(reader, post.id, "First", top);
    const second = await commentBy(reader, post.id, "Second", top);

    expect((await remove(first, reader.headers)).status).toBe(204);

    expect(await shape(post.id)).toEqual([[top, [second]]]);
    expect(await counts(post.id)).toEqual({ post: 2, card: 2 });
  });

  it("drops a placeholder once its last reply is deleted", async () => {
    const { author, post, reader } = await aConversation();
    const top = await commentBy(reader, post.id, "Top");
    const reply = await commentBy(author, post.id, "Reply", top);
    await remove(top, reader.headers);

    expect((await remove(reply, author.headers)).status).toBe(204);

    expect(await shape(post.id)).toEqual([]);
    expect(await counts(post.id)).toEqual({ post: 0, card: 0 });
  });

  it("lets the post's author delete a reply under a placeholder", async () => {
    const { author, post, reader } = await aConversation();
    const top = await commentBy(author, post.id, "Top");
    const reply = await commentBy(reader, post.id, "Reply", top);
    await remove(top, author.headers);

    const res = await remove(reply, author.headers);

    expect(res.status).toBe(204);
  });

  it("rejects a reply to a deleted comment with 400", async () => {
    const { post, reader } = await aConversation();
    const top = await commentBy(reader, post.id, "Top");
    await commentBy(reader, post.id, "Reply", top);
    await remove(top, reader.headers);

    const res = await call(createRoute, {
      method: "POST",
      path: `/api/posts/${post.id}/comments`,
      headers: { ...freshIp(), ...reader.headers },
      body: { body: "Hello?", parentId: top },
      params: { id: post.id },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ parentId: ["That comment doesn't exist."] });
  });

  it("keeps pages full when deleted comments drop out", async () => {
    const { post, reader } = await aConversation();
    const ids: string[] = [];
    for (let i = 0; i < 23; i++) {
      ids.push(await commentBy(reader, post.id, `Comment ${i}`));
      time.advance(1000);
    }
    const newestFirst = [...ids].reverse();
    await remove(newestFirst[0], reader.headers);
    await remove(newestFirst[5], reader.headers);

    const first = await list(post.id);
    const second = await list(post.id, first.body.nextCursor);

    const visible = newestFirst.filter((_, i) => i !== 0 && i !== 5);
    expect(first.body.comments.map((c: Listed) => c.id)).toEqual(visible.slice(0, 20));
    expect(first.body.nextCursor).toEqual(expect.any(String));
    expect(second.body.comments.map((c: Listed) => c.id)).toEqual(visible.slice(20));
    expect(second.body.nextCursor).toBeNull();
  });
});
