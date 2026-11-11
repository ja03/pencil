import { db } from "@/server/db";

/**
 * Records that `userId` likes `postId`. ON CONFLICT DO NOTHING on the
 * (userId, postId) key makes a repeated or concurrent like a no-op.
 */
export async function addLike(userId: string, postId: string, at: Date): Promise<void> {
  await db().like.createMany({ data: [{ userId, postId, createdAt: at }], skipDuplicates: true });
}

/** Removes `userId`'s like of `postId`, if there is one. */
export async function removeLike(userId: string, postId: string): Promise<void> {
  await db().like.deleteMany({ where: { userId, postId } });
}

/** How many readers like `postId`. */
export function countLikes(postId: string): Promise<number> {
  return db().like.count({ where: { postId } });
}

/** Whether `userId` likes `postId`. */
export async function hasLiked(userId: string, postId: string): Promise<boolean> {
  return (await db().like.count({ where: { userId, postId } })) > 0;
}
