// Shared by the API and the client: comment request and response shapes.
import { z } from "zod";

export const COMMENT_MAX_LENGTH = 1000;

/** Top-level comments per page. Replies always come all at once. */
export const COMMENTS_PAGE_SIZE = 20;

const WRITE_SOMETHING = "Write something first.";

/** Body of `POST /api/posts/:id/comments`. */
export const createCommentInput = z.object({
  body: z
    .string(WRITE_SOMETHING)
    .trim()
    .min(1, WRITE_SOMETHING)
    .max(COMMENT_MAX_LENGTH, "Keep comments to 1,000 characters."),
  /** The top-level comment this replies to; leave it out for a new top-level comment. */
  parentId: z
    .uuid("That comment doesn't exist.")
    .nullish()
    .transform((id) => id ?? null),
});

export type CreateCommentInput = z.infer<typeof createCommentInput>;
export type CreateCommentBody = z.input<typeof createCommentInput>;

export type CommentAuthor = { id: string; username: string };

/** A top-level comment or a reply. Plain text: render it as text, never as HTML. */
export type Comment = {
  id: string;
  /** Null for a top-level comment; the top-level comment it answers for a reply. */
  parentId: string | null;
  body: string;
  createdAt: string;
  author: CommentAuthor;
};

/** A top-level comment with every reply to it, oldest first. */
export type CommentThread = Comment & { replies: Comment[] };

/**
 * Body of `GET /api/posts/:id/comments`: top-level comments newest first,
 * 20 a page. Pass `nextCursor` back as `?cursor=` for the next page; null
 * means there are no more.
 */
export type CommentsResponse = { comments: CommentThread[]; nextCursor: string | null };

/** Body of `POST /api/posts/:id/comments`. */
export type CommentResponse = { comment: Comment };
