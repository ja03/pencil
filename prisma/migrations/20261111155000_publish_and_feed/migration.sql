-- Posts saved before this migration get 1 minute until their next save
-- recomputes it from the content.
-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "readingMinutes" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "posts_publishedAt_id_idx" ON "posts"("publishedAt", "id");
