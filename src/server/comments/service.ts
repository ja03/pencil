import type { CurrentUser } from "@/contracts/auth";
import {
  COMMENTS_PAGE_SIZE,
  type Comment,
  type CommentsResponse,
  type CommentThread,
  type CreateCommentInput,
} from "@/contracts/comments";
import { clock } from "@/server/clock";
import { encodeCursor, type KeysetPosition } from "@/server/http/cursor";
import { ApiError } from "@/server/http/errors";
import { isPublished } from "@/server/posts/repository";
import * as comments from "./repository";

function toComment(row: comments.CommentRow): Comment {
  return {
    id: row.id,
    parentId: row.parentId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: row.author,
  };
}

function toThread(row: comments.ThreadRow): CommentThread {
  return { ...toComment(row), replies: row.replies.map(toComment) };
}

/**
 * Only published posts that haven't been deleted have comments. A draft is
 * 404 to everyone, its author included: nobody can comment until it is out.
 */
async function requirePublished(postId: string): Promise<void> {
  if (!(await isPublished(postId))) throw new ApiError("NOT_FOUND", "That post doesn't exist.");
}

function invalidParent(message: string): ApiError {
  return new ApiError("VALIDATION_FAILED", message, { parentId: [message] });
}

/**
 * Threads stay one level deep: a reply must answer a top-level comment on
 * the same post. Anything else is a 400 on `parentId`.
 */
async function checkParent(postId: string, parentId: string): Promise<void> {
  const parent = await comments.findCommentPlace(parentId);
  if (!parent || parent.postId !== postId) throw invalidParent("That comment doesn't exist.");
  if (parent.parentId !== null) {
    throw invalidParent("You can only reply to a top-level comment.");
  }
}

/**
 * Adds `user`'s comment to a published post, or their reply to one of its
 * top-level comments. Verified users only; authors may comment on their own posts.
 */
export async function createComment(
  user: CurrentUser,
  postId: string,
  input: CreateCommentInput,
): Promise<Comment> {
  await requirePublished(postId);
  if (!user.emailVerified) throw new ApiError("FORBIDDEN", "Verify your email to comment.");
  if (input.parentId) await checkParent(postId, input.parentId);
  const row = await comments.createComment({
    postId,
    authorId: user.id,
    parentId: input.parentId,
    body: input.body,
    at: clock.now(),
  });
  return toComment(row);
}

/**
 * One page of a published post's top-level comments, newest first, after
 * `after` (null for the first page), each with all its replies, oldest first.
 * Readable without an account.
 */
export async function listComments(
  postId: string,
  after: KeysetPosition | null,
): Promise<CommentsResponse> {
  await requirePublished(postId);
  // One extra row says whether another page exists without a count query.
  const rows = await comments.findThreadPage(postId, after, COMMENTS_PAGE_SIZE + 1);
  const page = rows.slice(0, COMMENTS_PAGE_SIZE);
  const last = page.at(-1);
  return {
    comments: page.map(toThread),
    nextCursor:
      rows.length > COMMENTS_PAGE_SIZE && last
        ? encodeCursor({ at: last.createdAt, id: last.id })
        : null,
  };
}
