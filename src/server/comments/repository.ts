import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { KeysetPosition } from "@/server/http/cursor";

const author = { author: { select: { id: true, username: true } } } as const;

const withAuthor = { include: author } satisfies Prisma.CommentDefaultArgs;

/** Comments a reader can see as written. */
const LIVE = { deletedAt: null } as const;

/**
 * Top-level comments a reader sees: live ones, and deleted ones that still
 * have a live reply (shown as a placeholder). A deleted comment with no live
 * replies is gone from the thread.
 */
const SHOWN_THREAD = {
  parentId: null,
  OR: [LIVE, { replies: { some: LIVE } }],
} satisfies Prisma.CommentWhereInput;

/** A top-level comment with its author and every live reply, oldest first. */
const withReplies = {
  include: {
    ...author,
    replies: {
      where: LIVE,
      include: author,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    },
  },
} satisfies Prisma.CommentDefaultArgs;

export type CommentRow = Prisma.CommentGetPayload<typeof withAuthor>;
export type ThreadRow = Prisma.CommentGetPayload<typeof withReplies>;

export type NewComment = {
  postId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  at: Date;
};

export function createComment({ at, ...data }: NewComment): Promise<CommentRow> {
  return db().comment.create({ data: { ...data, createdAt: at }, ...withAuthor });
}

/**
 * Where a live comment sits: its post, and its parent if it is a reply.
 * Null for a deleted or unknown comment.
 */
export function findCommentPlace(
  id: string,
): Promise<{ postId: string; parentId: string | null } | null> {
  return db().comment.findFirst({
    where: { id, ...LIVE },
    select: { postId: true, parentId: true },
  });
}

/** A live comment with the authors of it and of its post, or null. */
export function findLiveComment(id: string) {
  return db().comment.findFirst({
    where: { id, ...LIVE },
    include: { ...author, post: { select: { authorId: true } } },
  });
}

/** Replaces a comment's text, stamping `editedAt` when it is given. */
export function updateCommentBody(
  id: string,
  body: string,
  editedAt: Date | undefined,
): Promise<CommentRow> {
  return db().comment.update({
    where: { id },
    data: { body, editedAt },
    ...withAuthor,
  });
}

/**
 * Soft-deletes a live comment. The row stays so replies keep their parent;
 * readers see a placeholder while it has live replies, and nothing after.
 */
export async function softDeleteComment(id: string, at: Date): Promise<void> {
  await db().comment.updateMany({
    where: { id, ...LIVE },
    data: { deletedAt: at },
  });
}

/**
 * One page of `postId`'s shown top-level comments, newest first, starting
 * after `after` (keyset paging on createdAt, then id), each with all its
 * live replies.
 */
export function findThreadPage(
  postId: string,
  after: KeysetPosition | null,
  take: number,
): Promise<ThreadRow[]> {
  return db().comment.findMany({
    where: {
      postId,
      ...SHOWN_THREAD,
      ...(after && {
        AND: {
          OR: [{ createdAt: { lt: after.at } }, { createdAt: after.at, id: { lt: after.id } }],
        },
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    ...withReplies,
  });
}
