/** The parts of a post its embedding is made from. Content is deliberately not among them. */
export type EmbeddingSource = {
  title: string;
  description: string | null;
  /** Normalized tag names, in the author's order. */
  tags: string[];
};

/**
 * The text a post is embedded from: its title, then its description, then
 * its tags as hashtags. Only these count, so edits to the content alone never
 * re-embed.
 */
export function embeddingTextOf({ title, description, tags }: EmbeddingSource): string {
  return [title, description, tags.map((tag) => `#${tag}`).join(" ")]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n");
}

/** Whether a change from `before` to `after` changes the post's embedding text. */
export function changesEmbedding(before: EmbeddingSource, after: EmbeddingSource): boolean {
  return embeddingTextOf(before) !== embeddingTextOf(after);
}
