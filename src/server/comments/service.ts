import type { CurrentUser } from "@/contracts/auth";
import {
  COMMENTS_PAGE_SIZE,
  type Comment,
  type CommentsResponse,
  type CommentThread,
  type CreateCommentInput,
  type EditCommentInput,
} from "@/contracts/comments";
import { clock } from "@/server/clock";
import { encodeCursor, type KeysetPosition } from "@/server/http/cursor";
import { ApiError } from "@/server/http/errors";
import { isPublished } from "@/server/posts/repository";
import * as comments from "./repository";

const NO_SUCH_COMMENT = "That comment doesn't exist.";

function toComment(row: comments.CommentRow): Comment {
  return {
    id: row.id,
    parentId: row.parentId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    author: row.author,
    deleted: false,
  };
}

/** A deleted thread keeps only its place: no text, no author. */
function toThread(row: comments.ThreadRow): CommentThread {
  const replies = row.replies.map(toComment);
  if (!row.deletedAt) return { ...toComment(row), replies };
  return {
    id: row.id,
    parentId: null,
    createdAt: row.createdAt.toISOString(),
    deleted: true,
    replies,
  };
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
  if (!parent || parent.postId !== postId) throw invalidParent(NO_SUCH_COMMENT);
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

/**
 * A live comment on a published post, for changing it. Deleted comments,
 * and comments on posts that are deleted, are 404.
 */
async function findForChange(id: string) {
  const row = await comments.findLiveComment(id);
  if (!row || !(await isPublished(row.postId))) throw new ApiError("NOT_FOUND", NO_SUCH_COMMENT);
  return row;
}

/**
 * Replaces the text of `user`'s comment. Only its author may edit it, and a
 * real change marks it edited; saving the same text changes nothing.
 */
export async function editComment(
  user: CurrentUser,
  id: string,
  input: EditCommentInput,
): Promise<Comment> {
  const row = await findForChange(id);
  if (row.authorId !== user.id) {
    throw new ApiError("FORBIDDEN", "Only the person who wrote a comment can edit it.");
  }
  if (input.body === row.body) return toComment(row);
  return toComment(await comments.updateCommentBody(id, input.body, clock.now()));
}

/**
 * Deletes a comment. Its author may, and so may the author of the post it
 * is on. A deleted comment with live replies shows as a placeholder; one
 * without disappears from the thread.
 */
export async function deleteComment(user: CurrentUser, id: string): Promise<void> {
  const row = await findForChange(id);
  if (row.authorId !== user.id && row.post.authorId !== user.id) {
    throw new ApiError(
      "FORBIDDEN",
      "Only the commenter or the post's author can delete this comment.",
    );
  }
  await comments.softDeleteComment(id, clock.now());
}
