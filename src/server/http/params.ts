import { z } from "zod";
import { normalizeTag } from "@/contracts/tags";
import { normalizeUsername } from "@/contracts/users";
import { ApiError } from "./errors";

/**
 * A post id from the URL. Anything that isn't a post id can't be a post, so
 * it's a 404 rather than a validation error.
 */
export async function postIdParam(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new ApiError("NOT_FOUND", "That post doesn't exist.");
  return parsed.data;
}

/**
 * A tag from the URL, normalized, so `/tags/React` finds "react". Anything
 * that can't be a tag is a 404.
 */
export async function tagParam(params: Promise<{ tag: string }>): Promise<string> {
  const { tag } = await params;
  const name = normalizeTag(safeDecode(tag));
  if (!name) throw new ApiError("NOT_FOUND", "That tag doesn't exist.");
  return name;
}

export const NO_SUCH_AUTHOR = "There's no author with that username.";

/**
 * A username from the URL, lowercased, so `/u/Lina_K` finds "lina_k".
 * Anything that can't be a username is a 404.
 */
export async function usernameParam(params: Promise<{ username: string }>): Promise<string> {
  const { username } = await params;
  const name = normalizeUsername(safeDecode(username));
  if (!name) throw new ApiError("NOT_FOUND", NO_SUCH_AUTHOR);
  return name;
}

/** Decodes a percent-encoded segment; a segment that isn't encoded comes back as is. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
