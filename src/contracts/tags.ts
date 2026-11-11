// Shared by the API and the client: what a tag is and how input becomes one.
import { z } from "zod";

/** The most tags one post can carry. */
export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 30;

const TAG = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

/**
 * The tag `raw` stands for, or null when it can't be one. Tags are lowercase
 * letters and numbers (any script) joined by single hyphens, so "React",
 * "#react" and " REACT " are all the tag "react", and "Machine Learning" is
 * "machine-learning".
 */
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .normalize("NFC")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-");
  return tag.length <= MAX_TAG_LENGTH && TAG.test(tag) ? tag : null;
}

/**
 * A post's tags as the author typed them: normalized, repeats dropped, in
 * the author's order, at most `MAX_TAGS`.
 */
export const postTags = z
  // Items are checked here rather than by z.string(), so every problem is
  // reported on the list ("tags") where the editor shows it.
  .array(z.unknown(), "Tags must be a list.")
  .transform((list, ctx): string[] => {
    const tags: string[] = [];
    for (const raw of list) {
      if (typeof raw !== "string") {
        ctx.issues.push({ code: "custom", message: "Each tag must be text.", input: list });
        return z.NEVER;
      }
      const tag = normalizeTag(raw);
      if (tag === null) {
        ctx.issues.push({
          code: "custom",
          message: `“${raw.trim().slice(0, MAX_TAG_LENGTH)}” isn't a valid tag. Use letters, numbers and hyphens.`,
          input: list,
        });
        return z.NEVER;
      }
      if (!tags.includes(tag)) tags.push(tag);
    }
    if (tags.length > MAX_TAGS) {
      ctx.issues.push({ code: "custom", message: `Use up to ${MAX_TAGS} tags.`, input: list });
      return z.NEVER;
    }
    return tags;
  });

/** An existing tag offered while typing, with how many published posts use it. */
export type TagSuggestion = { name: string; postCount: number };

/** Body of `GET /api/tags?q=`: the best matches first. */
export type TagSuggestionsResponse = { tags: TagSuggestion[] };

/** Suggestions returned per request. */
export const TAG_SUGGESTION_LIMIT = 8;

/** Where a tag's page lives. */
export function tagPath(tag: string): string {
  return `/tags/${encodeURIComponent(tag)}`;
}
