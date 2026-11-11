import { describe, expect, it } from "vitest";
import type { Comment, CommentThread } from "@/contracts/comments";
import { visibleThreads, type LocalChanges } from "./comment-threads";

const author = { id: "u1", username: "ada" };

function comment(id: string, parentId: string | null = null): Comment {
  return {
    id,
    parentId,
    body: id,
    createdAt: "2026-01-01T00:00:00.000Z",
    editedAt: null,
    author,
    deleted: false,
  };
}

function thread(id: string, replies: string[] = []): CommentThread {
  return { ...comment(id), replies: replies.map((r) => comment(r, id)) };
}

function placeholder(id: string, replies: string[]): CommentThread {
  return {
    id,
    parentId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    deleted: true,
    replies: replies.map((r) => comment(r, id)),
  };
}

const ids = (threads: CommentThread[]) =>
  threads.map((t) => [t.id, t.replies.map((r) => r.id)]);

const none: LocalChanges = { posted: [], edited: {}, deleted: [] };

/** Only the reader's new comments, oldest first. */
const threadsWithPosted = (pages: Parameters<typeof visibleThreads>[0], posted: Comment[]) =>
  visibleThreads(pages, { ...none, posted });

describe("visibleThreads: what the reader posted", () => {
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

describe("visibleThreads: what the reader edited", () => {
  it("shows the edited text of a comment or a reply, wherever it was loaded or posted", () => {
    const pages = [{ comments: [thread("c1", ["r1"])], nextCursor: null }];
    const posted = [comment("n1")];
    const edited = {
      c1: { ...comment("c1"), body: "c1 fixed", editedAt: "2026-01-02T00:00:00.000Z" },
      r1: { ...comment("r1", "c1"), body: "r1 fixed" },
      n1: { ...comment("n1"), body: "n1 fixed" },
    };

    const threads = visibleThreads(pages, { ...none, posted, edited });

    expect(threads.map((t) => [!t.deleted && t.body, t.replies.map((r) => r.body)])).toEqual([
      ["n1 fixed", []],
      ["c1 fixed", ["r1 fixed"]],
    ]);
    expect(threads[1]).toMatchObject({ editedAt: "2026-01-02T00:00:00.000Z" });
  });
});

describe("visibleThreads: what the reader deleted", () => {
  it("drops a deleted comment that has no replies, and a deleted reply", () => {
    const pages = [{ comments: [thread("c2"), thread("c1", ["r1", "r2"])], nextCursor: null }];

    const threads = visibleThreads(pages, { ...none, deleted: ["c2", "r1"] });

    expect(ids(threads)).toEqual([["c1", ["r2"]]]);
  });

  it("turns a deleted comment with replies into a placeholder that keeps them", () => {
    const pages = [{ comments: [thread("c1", ["r1"])], nextCursor: null }];

    const [shown] = visibleThreads(pages, { ...none, deleted: ["c1"] });

    expect(shown).toEqual(placeholder("c1", ["r1"]));
  });

  it("drops a placeholder once its last reply is deleted", () => {
    const pages = [{ comments: [placeholder("c2", ["r1"]), thread("c1")], nextCursor: null }];

    const threads = visibleThreads(pages, { ...none, deleted: ["r1"] });

    expect(ids(threads)).toEqual([["c1", []]]);
  });

  it("drops comments the reader posted and then deleted", () => {
    const pages = [{ comments: [thread("c1")], nextCursor: null }];
    const posted = [comment("n1"), comment("r1", "c1")];

    const threads = visibleThreads(pages, { ...none, posted, deleted: ["n1", "r1"] });

    expect(ids(threads)).toEqual([["c1", []]]);
  });
});
