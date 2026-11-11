import type { Comment, CommentsResponse, CommentThread } from "@/contracts/comments";

/** What the reader changed in a comment section since its page loaded. */
export type LocalChanges = {
  /** New comments and replies, oldest first. */
  posted: Comment[];
  /** The latest saved version of each comment the reader edited, by id. */
  edited: Record<string, Comment>;
  /** Ids of the comments the reader deleted. */
  deleted: string[];
};

function unique<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id));
}

/**
 * The threads a comment section shows: the pages loaded so far, with the
 * reader's own changes on top. New top-level comments go on top, as the
 * newest; new replies go at the end of their thread. A comment that also
 * arrives in a loaded page shows once. Edited comments show their new text.
 * Deleted replies go; a deleted top-level comment stays as a placeholder
 * while it has replies and goes once it has none, as the server shows it.
 */
export function visibleThreads(
  pages: CommentsResponse[],
  { posted, edited, deleted }: LocalChanges,
): CommentThread[] {
  const gone = new Set(deleted);
  const latest = (comment: Comment): Comment => edited[comment.id] ?? comment;

  const newTopLevel = posted
    .filter((comment) => comment.parentId === null)
    .reverse()
    .map((comment): CommentThread => ({ ...comment, replies: [] }));
  const threads = unique([...newTopLevel, ...pages.flatMap((page) => page.comments)]);

  return threads.flatMap((thread): CommentThread[] => {
    const newReplies = posted.filter((comment) => comment.parentId === thread.id);
    const replies = unique([...thread.replies, ...newReplies])
      .filter((reply) => !gone.has(reply.id))
      .map(latest);
    if (thread.deleted || gone.has(thread.id)) {
      if (replies.length === 0) return [];
      return [
        { id: thread.id, parentId: null, createdAt: thread.createdAt, deleted: true, replies },
      ];
    }
    return [{ ...latest(thread), replies }];
  });
}
