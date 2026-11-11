// Shared by the API and the client: like request and response shapes.

/**
 * Body of `PUT` and `DELETE /api/posts/:id/like`: whether the signed-in
 * reader now likes the post, and how many readers do in all.
 */
export type LikeResponse = { liked: boolean; likeCount: number };
