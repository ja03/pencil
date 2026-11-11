import type { AuthorProfile } from "@/contracts/users";
import { countPublishedBy } from "@/server/posts/repository";
import { findUserByUsername } from "./repository";

/**
 * The public profile of the author with this (normalized) username, or null
 * when there is none. Anyone may read it; it never carries the email.
 */
export async function findProfile(username: string): Promise<AuthorProfile | null> {
  const user = await findUserByUsername(username);
  if (!user) return null;
  return {
    username: user.username,
    publishedCount: await countPublishedBy(user.id),
    joinedAt: user.createdAt.toISOString(),
  };
}
