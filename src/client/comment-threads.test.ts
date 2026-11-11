import { describe, expect, it } from "vitest";
import type { Comment, CommentThread } from "@/contracts/comments";
import { threadsWithPosted } from "./comment-threads";

const author = { id: "u1", username: "ada" };

function comment(id: string, parentId: string | null = null): Comment {
  return { id, parentId, body: id, createdAt: "2026-01-01T00:00:00.000Z", author };
}

function thread(id: string, replies: string[] = []): CommentThread {
  return { ...comment(id), replies: replies.map((r) => comment(r, id)) };
}

const ids = (threads: CommentThread[]) =>
  threads.map((t) => [t.id, t.replies.map((r) => r.id)]);

describe("threadsWithPosted", () => {
  it("shows the loaded pages in order when nothing was posted", () => {
    const pages = [
      { comments: [thread("c3"), thread("c2", ["r1"])], nextCursor: "x" },
      { comments: [thread("c1")], nextCursor: null },
    ];

    expect(ids(threadsWithPosted(pages, []))).toEqual([
      ["c3", []],
      ["c2", ["r1"]],
      ["c1", []],
    ]);
  });

  it("puts new top-level comments on top, newest first", () => {
    const pages = [{ comments: [thread("c1")], nextCursor: null }];

    const threads = threadsWithPosted(pages, [comment("n1"), comment("n2")]);

    expect(ids(threads)).toEqual([
      ["n2", []],
      ["n1", []],
      ["c1", []],
    ]);
  });

  it("adds new replies to the end of their thread, including a new thread", () => {
    const pages = [{ comments: [thread("c1", ["r1"])], nextCursor: null }];

    const threads = threadsWithPosted(pages, [
      comment("r2", "c1"),
      comment("n1"),
      comment("r3", "n1"),
    ]);

    expect(ids(threads)).toEqual([
      ["n1", ["r3"]],
      ["c1", ["r1", "r2"]],
    ]);
  });

  it("shows a comment once when it was posted and also loaded", () => {
    const pages = [
      { comments: [thread("c2")], nextCursor: "x" },
      { comments: [thread("c2", ["r1"]), thread("c1")], nextCursor: null },
    ];

    const threads = threadsWithPosted(pages, [comment("r1", "c2")]);

    expect(ids(threads)).toEqual([
      ["c2", ["r1"]],
      ["c1", []],
    ]);
  });
});
