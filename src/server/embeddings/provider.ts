import { z } from "zod";
import { env } from "@/server/env";
import { EMBEDDING_DIMENSIONS, normalize } from "./vector";

/**
 * Turns text into a vector that captures its meaning: the AI boundary.
 * Texts that mean similar things get vectors that point the same way.
 */
export interface EmbeddingProvider {
  /** A normalized vector of `EMBEDDING_DIMENSIONS` numbers for `text`. */
  embed(text: string): Promise<number[]>;
}

const GEMINI_MODEL = "gemini-embedding-001";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
/** Longer than any healthy call; a stuck one must not hold a background slot forever. */
const GEMINI_TIMEOUT_MS = 15_000;

const geminiResponse = z.object({ embedding: z.object({ values: z.array(z.number()) }) });

/**
 * Gemini's `gemini-embedding-001`, asked for 768 dimensions. Gemini only
 * normalizes its full 3072-dimension output, so shorter ones are normalized
 * here.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly apiKey: string) {}

  async embed(text: string): Promise<number[]> {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: { parts: [{ text }] },
        taskType: "SEMANTIC_SIMILARITY",
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Gemini embedding failed with ${response.status}: ${await response.text()}`);
    }
    const { values } = geminiResponse.parse(await response.json()).embedding;
    if (values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Gemini returned ${values.length} dimensions, not ${EMBEDDING_DIMENSIONS}.`);
    }
    return normalize(values);
  }
}

/** The provider for an API key: Gemini when there is one, otherwise none. */
export function providerForKey(apiKey: string | undefined): EmbeddingProvider | null {
  return apiKey ? new GeminiEmbeddingProvider(apiKey) : null;
}

let override: { provider: EmbeddingProvider | null } | undefined;

/**
 * The provider posts are embedded with: Gemini when `GEMINI_API_KEY` is set,
 * otherwise none, and recommendations use tag overlap. Tests replace it with
 * a fake through `setEmbeddingProvider`; nothing in tests ever calls Gemini.
 */
export function embeddingProvider(): EmbeddingProvider | null {
  return override ? override.provider : providerForKey(env().GEMINI_API_KEY);
}

/**
 * Replaces the provider; null switches AI off as if no key were set, and
 * nothing goes back to the key's provider. Tests only.
 */
export function setEmbeddingProvider(provider?: EmbeddingProvider | null): void {
  override = provider === undefined ? undefined : { provider };
}
