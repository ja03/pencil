// Embeds every published post that has no vector yet: posts from before the
// AI key was set, and posts whose embedding failed after a save. Safe to run
// any time; posts that already have a vector are left alone.
//
//   npm run embeddings:backfill
import "dotenv/config";
import { db } from "../src/server/db";
import { embeddingProvider } from "../src/server/embeddings/provider";
import { backfillEmbeddings } from "../src/server/embeddings/service";

async function main() {
  const provider = embeddingProvider();
  if (!provider) {
    console.error("GEMINI_API_KEY isn't set, so there is nothing to embed with.");
    process.exitCode = 1;
    return;
  }
  const { embedded, failed } = await backfillEmbeddings(provider, console.error);
  console.log(`Embedded ${embedded} post${embedded === 1 ? "" : "s"}; ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => db().$disconnect());
