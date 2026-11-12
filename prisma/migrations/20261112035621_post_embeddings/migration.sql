-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "embedding" vector(768);

-- Nearest-neighbour search on embeddings (cosine distance, `<=>`). Prisma
-- can't express an HNSW index, so it lives only in this migration.
CREATE INDEX "posts_embedding_idx" ON "posts" USING hnsw ("embedding" vector_cosine_ops);
