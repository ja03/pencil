import type { LikeResponse } from "@/contracts/likes";

/**
 * A like button's state for optimistic updates: what the server last
 * confirmed, and what the reader wants now. The button shows what they want
 * straight away and sends requests until the server agrees; a failure rolls
 * back to what the server last confirmed.
 */
export type LikeState = { server: LikeResponse; wanted: boolean };

export function likeState(server: LikeResponse): LikeState {
  return { server, wanted: server.liked };
}

/** The reader clicked the button. */
export function toggled(state: LikeState): LikeState {
  return { ...state, wanted: !state.wanted };
}

/** The server answered a request; what the reader wants since then stands. */
export function confirmed(state: LikeState, server: LikeResponse): LikeState {
  return { ...state, server };
}

/** A request failed: back to what the server last confirmed. */
export function rollBack(state: LikeState): LikeState {
  return likeState(state.server);
}

/** What the button shows: the reader's wish, with the count adjusted to match. */
export function shown({ server, wanted }: LikeState): LikeResponse {
  const change = wanted === server.liked ? 0 : wanted ? 1 : -1;
  return { liked: wanted, likeCount: Math.max(0, server.likeCount + change) };
}

/** Whether to like (true) or unlike (false) next, or null when the server already agrees. */
export function unsent({ server, wanted }: LikeState): boolean | null {
  return wanted === server.liked ? null : wanted;
}
