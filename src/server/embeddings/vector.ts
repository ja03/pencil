// Pure vector maths for post embeddings. Every stored embedding has unit
// length, so cosine similarity is a plain dot product and pgvector's cosine
// distance (`<=>`) ranks posts by meaning.

/** How many numbers every post embedding has (Gemini's 768-dimension output). */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * `vector` scaled to unit length. Throws for a vector that has no direction
 * (all zeros) or holds a non-finite number, since neither can be compared.
 */
export function normalize(vector: readonly number[]): number[] {
  if (vector.some((x) => !Number.isFinite(x))) {
    throw new Error("An embedding must hold only finite numbers.");
  }
  const length = Math.hypot(...vector);
  if (length === 0) throw new Error("An all-zero vector can't be normalized.");
  return vector.map((x) => x / length);
}

/**
 * The direction `vectors` share: their mean, normalized. A reader's taste is
 * the average of the posts they liked. Throws when given none, or vectors of
 * different lengths.
 */
export function average(vectors: readonly (readonly number[])[]): number[] {
  const [first, ...rest] = vectors;
  if (!first) throw new Error("Can't average no vectors.");
  if (rest.some((vector) => vector.length !== first.length)) {
    throw new Error("Can't average vectors of different lengths.");
  }
  const sum = first.map((x, i) => rest.reduce((total, vector) => total + vector[i]!, x));
  return normalize(sum.map((x) => x / vectors.length));
}

/** `vector` as pgvector's text form, `[0.1,0.2,…]`, to cast with `::vector`. */
export function toVectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

/** A vector from pgvector's text form (`embedding::text`). */
export function parseVector(text: string): number[] {
  const values: unknown = JSON.parse(text);
  if (!Array.isArray(values) || values.some((x) => typeof x !== "number")) {
    throw new Error("Not a vector.");
  }
  return values as number[];
}
