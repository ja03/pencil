import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { KeysetPosition } from "@/server/http/cursor";

const author = { author: { select: { id: true, username: true } } } as const;

const withAuthor = { include: author } satisfies Prisma.CommentDefaultArgs;

/** A top-level comment with its author and every reply, oldest first. */
const withReplies = {
  include: {
    ...author,
    replies: { include: author, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
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

/** Where a comment sits: its post, and its parent if it is a reply. */
export function findCommentPlace(
  id: string,
): Promise<{ postId: string; parentId: string | null } | null> {
  return db().comment.findUnique({ where: { id }, select: { postId: true, parentId: true } });
}

/**
 * One page of `postId`'s top-level comments, newest first, starting after
 * `after` (keyset paging on createdAt, then id), each with all its replies.
 */
export function findThreadPage(
  postId: string,
  after: KeysetPosition | null,
  take: number,
): Promise<ThreadRow[]> {
  return db().comment.findMany({
    where: {
      postId,
      parentId: null,
      ...(after && {
        OR: [
          { createdAt: { lt: after.at } },
          { createdAt: after.at, id: { lt: after.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    ...withReplies,
  });
}
