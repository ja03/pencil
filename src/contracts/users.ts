// Shared by the API and the client: public author profiles.
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from "./auth";

/** What anyone can see about an author. Never their email or id. */
export type AuthorProfile = {
  username: string;
  /** Published posts that haven't been deleted. */
  publishedCount: number;
  /** When the account was created, for "Writing on Pencil since…". */
  joinedAt: string;
};

/** Body of `GET /api/users/:username`. */
export type AuthorProfileResponse = { profile: AuthorProfile };

/** The profile page for `username`. */
export function profilePath(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

/**
 * The username a URL segment names, lowercased, or null when it can't be one.
 * Usernames are stored lowercase, so `/u/Lina_K` finds "lina_k".
 */
export function normalizeUsername(segment: string): string | null {
  const name = segment.trim().toLowerCase();
  const fits = name.length >= USERNAME_MIN_LENGTH && name.length <= USERNAME_MAX_LENGTH;
  return fits && USERNAME_PATTERN.test(name) ? name : null;
}
