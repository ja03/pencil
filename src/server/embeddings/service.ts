import { runAfterResponse } from "@/server/background";
import { embeddingProvider, type EmbeddingProvider } from "./provider";
import * as embeddings from "./repository";
import { embeddingTextOf } from "./text";

/**
 * Embeds the post from its title, description and tags as they are now, and
 * stores the vector. Drafts, deleted and unknown posts are skipped. Reading
 * the post when the job runs, not when it was scheduled, means a later edit
 * is never overwritten by an earlier one's text.
 */
export async function embedPost(provider: EmbeddingProvider, postId: string): Promise<boolean> {
  const source = await embeddings.findEmbeddingSource(postId);
  if (!source) return false;
  await embeddings.saveEmbedding(postId, await provider.embed(embeddingTextOf(source)));
  return true;
}

/**
 * Embeds the post once the response has been sent, when AI is configured. A
 * slow or failing provider never holds up or fails the save: the error is
 * logged, and the post stays without a vector until the backfill runs.
 */
export function embedAfterResponse(postId: string): void {
  const provider = embeddingProvider();
  if (!provider) return;
  runAfterResponse(`embed post ${postId}`, async () => {
    await embedPost(provider, postId);
  });
}

/**
 * Called when a published post's title, description or tags changed: its
 * vector no longer matches, so it is dropped now and remade after the
 * response. Without AI configured there is nothing to remake, so the stale
 * vector is dropped all the same, for the backfill to fill in later.
 */
export async function reembedAfterResponse(postId: string): Promise<void> {
  await embeddings.clearEmbedding(postId);
  embedAfterResponse(postId);
}

export type BackfillResult = { embedded: number; failed: number };

/**
 * Embeds every published, non-deleted post that has no vector, one at a
 * time, oldest first. A post that fails is logged and skipped so the rest
 * still catch up; running it again retries it.
 */
export async function backfillEmbeddings(
  provider: EmbeddingProvider,
  log: (message: string) => void = () => {},
): Promise<BackfillResult> {
  const result: BackfillResult = { embedded: 0, failed: 0 };
  for (const postId of await embeddings.findPostsMissingEmbedding()) {
    try {
      if (await embedPost(provider, postId)) result.embedded++;
    } catch (error) {
      result.failed++;
      log(`Couldn't embed post ${postId}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return result;
}
