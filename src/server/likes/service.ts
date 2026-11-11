import type { CurrentUser } from "@/contracts/auth";
import type { LikeResponse } from "@/contracts/likes";
import { clock } from "@/server/clock";
import { ApiError } from "@/server/http/errors";
import { isPublished } from "@/server/posts/repository";
import * as likes from "./repository";

/**
 * Only verified readers may like, and only published posts that haven't been
 * deleted can be liked. A draft is 404 to everyone, its author included:
 * there is nothing to like until it is published.
 */
async function checkCanLike(user: CurrentUser, postId: string): Promise<void> {
  if (!(await isPublished(postId))) throw new ApiError("NOT_FOUND", "That post doesn't exist.");
  if (!user.emailVerified) throw new ApiError("FORBIDDEN", "Verify your email to like posts.");
}

async function stateAfter(postId: string, liked: boolean): Promise<LikeResponse> {
  return { liked, likeCount: await likes.countLikes(postId) };
}

/** Likes the post for `user`. Liking it again changes nothing. Authors may like their own. */
export async function likePost(user: CurrentUser, postId: string): Promise<LikeResponse> {
  await checkCanLike(user, postId);
  await likes.addLike(user.id, postId, clock.now());
  return stateAfter(postId, true);
}

/** Takes back `user`'s like. Unliking a post they don't like changes nothing. */
export async function unlikePost(user: CurrentUser, postId: string): Promise<LikeResponse> {
  await checkCanLike(user, postId);
  await likes.removeLike(user.id, postId);
  return stateAfter(postId, false);
}
