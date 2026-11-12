// Post embeddings. Prisma can't read or write pgvector's `vector` type, so
// every query here is SQL; vectors travel as pgvector's text form.
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { EmbeddingSource } from "./text";
import { parseVector, toVectorLiteral } from "./vector";

const uuid = (id: string) => Prisma.sql`${id}::uuid`;

/** The literal `vector` for SQL, as pgvector's text form cast to `vector`. */
export const vectorSql = (vector: readonly number[]) =>
  Prisma.sql`${toVectorLiteral(vector)}::vector`;

/** Stores `vector` as the post's embedding. */
export async function saveEmbedding(postId: string, vector: readonly number[]): Promise<void> {
  await db().$executeRaw`UPDATE posts SET embedding = ${vectorSql(vector)} WHERE id = ${uuid(postId)}`;
}

/**
 * Forgets the post's embedding, so it counts as missing one until it is
 * embedded again (and the backfill picks it up if that fails).
 */
export async function clearEmbedding(postId: string): Promise<void> {
  await db().$executeRaw`UPDATE posts SET embedding = NULL WHERE id = ${uuid(postId)}`;
}

/** The post's embedding, or null when it has none. */
export async function findEmbedding(postId: string): Promise<number[] | null> {
  const rows = await db().$queryRaw<{ embedding: string | null }[]>`
    SELECT embedding::text AS embedding FROM posts WHERE id = ${uuid(postId)}`;
  const text = rows[0]?.embedding;
  return text ? parseVector(text) : null;
}

/** The embeddings of the posts `userId` liked, leaving out those not embedded yet. */
export async function findLikedEmbeddings(userId: string): Promise<number[][]> {
  const rows = await db().$queryRaw<{ embedding: string }[]>`
    SELECT p.embedding::text AS embedding
    FROM likes l
    JOIN posts p ON p.id = l."postId"
    WHERE l."userId" = ${uuid(userId)} AND p.embedding IS NOT NULL`;
  return rows.map((row) => parseVector(row.embedding));
}

/**
 * What a published, non-deleted post's embedding is made from, or null for
 * a draft, a deleted post or an unknown id.
 */
export async function findEmbeddingSource(postId: string): Promise<EmbeddingSource | null> {
  const post = await db().post.findFirst({
    where: { id: postId, publishedAt: { not: null }, deletedAt: null },
    select: {
      title: true,
      description: true,
      tags: { select: { tag: { select: { name: true } } }, orderBy: { position: "asc" } },
    },
  });
  return post && { ...post, tags: post.tags.map((t) => t.tag.name) };
}

/** Published, non-deleted posts with no embedding, oldest published first. */
export async function findPostsMissingEmbedding(): Promise<string[]> {
  const rows = await db().$queryRaw<{ id: string }[]>`
    SELECT id FROM posts
    WHERE embedding IS NULL AND "publishedAt" IS NOT NULL AND "deletedAt" IS NULL
    ORDER BY "publishedAt" ASC, id ASC`;
  return rows.map((row) => row.id);
}
