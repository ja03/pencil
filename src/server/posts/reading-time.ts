import { plainTextOf, type PostContent } from "@/contracts/post-content";

/** A typical adult reading speed for prose on screen. */
export const WORDS_PER_MINUTE = 230;

/** Estimated minutes to read the post, rounded up, never less than 1. */
export function readingMinutesOf(content: PostContent): number {
  const text = plainTextOf(content);
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
