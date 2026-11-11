import type { Comment, CommentsResponse, CommentThread } from "@/contracts/comments";

function unique<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id));
}

/**
 * The threads a comment section shows: the pages loaded so far, plus what
 * the reader posted since the page loaded (oldest first in `posted`). New
 * top-level comments go on top, as the newest; new replies go at the end of
 * their thread. A comment that also arrives in a loaded page shows once.
 */
export function threadsWithPosted(pages: CommentsResponse[], posted: Comment[]): CommentThread[] {
  const newTopLevel = posted
    .filter((comment) => comment.parentId === null)
    .reverse()
    .map((comment): CommentThread => ({ ...comment, replies: [] }));
  const threads = unique([...newTopLevel, ...pages.flatMap((page) => page.comments)]);
  return threads.map((thread) => {
    const newReplies = posted.filter((comment) => comment.parentId === thread.id);
    if (newReplies.length === 0) return thread;
    return { ...thread, replies: unique([...thread.replies, ...newReplies]) };
  });
}
