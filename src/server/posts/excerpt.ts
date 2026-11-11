import { plainTextOf, type PostContent } from "@/contracts/post-content";

export const EXCERPT_LENGTH = 160;

/**
 * The start of the post's text, about 160 characters, cut at a word boundary
 * with an ellipsis when it is longer. Used when there is no description.
 */
export function excerptOf(content: PostContent): string {
  const text = plainTextOf(content);
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > EXCERPT_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s.,;:!?-]+$/, "")}…`;
}
