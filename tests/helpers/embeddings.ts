import { db } from "@/server/db";
import { setEmbeddingProvider, type EmbeddingProvider } from "@/server/embeddings/provider";
import { EMBEDDING_DIMENSIONS, normalize } from "@/server/embeddings/vector";

/** FNV-1a: a small, stable string hash. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A deterministic stand-in for meaning: a bag of words, each word adding 1 to
 * a dimension picked by its hash, normalized. Texts sharing more words point
 * more the same way, so tests can reason about which posts are "closest".
 */
export function wordVector(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    vector[hash(word) % EMBEDDING_DIMENSIONS]! += 1;
  }
  return normalize(vector);
}

/**
 * Switches AI recommendations on with a fake embedding provider, never real
 * Gemini. The per-test setup switches it off again afterwards.
 *
 *   const ai = fakeEmbeddings();
 *   ai.embedded;          // every text sent to the provider, in order
 *   ai.fail();            // every call from now on throws
 *   const release = ai.hold(); …; release();  // calls wait until released
 */
export function fakeEmbeddings() {
  const embedded: string[] = [];
  let failing = false;
  let gate: Promise<void> | null = null;

  const provider: EmbeddingProvider = {
    async embed(text) {
      embedded.push(text);
      if (gate) await gate;
      if (failing) throw new Error("The embedding service is down.");
      return wordVector(text);
    },
  };
  setEmbeddingProvider(provider);

  return {
    provider,
    embedded,
    fail() {
      failing = true;
    },
    recover() {
      failing = false;
    },
    hold(): () => void {
      let release!: () => void;
      gate = new Promise((resolve) => (release = resolve));
      return () => {
        gate = null;
        release();
      };
    },
  };
}

/** Whether the post has a stored embedding. */
export async function hasEmbedding(postId: string): Promise<boolean> {
  const rows = await db().$queryRaw<{ embedded: boolean }[]>`
    SELECT embedding IS NOT NULL AS embedded FROM posts WHERE id = ${postId}::uuid`;
  return rows[0]?.embedded ?? false;
}
