import { Prisma } from "@/generated/prisma/client";
import type { PostContent } from "@/contracts/post-content";
import { db } from "@/server/db";
import type { FeedPosition } from "./cursor";
import { firstFreeSlug } from "./slug";

const withAuthor = { author: { select: { id: true, username: true } } } as const;

export type PostRow = Prisma.PostGetPayload<{ include: typeof withAuthor }>;

/** A post that hasn't been deleted, with its author. Drafts included. */
export function findPostById(id: string): Promise<PostRow | null> {
  return db().post.findFirst({ where: { id, deletedAt: null }, include: withAuthor });
}

/** A post that hasn't been deleted, by its slug, with its author. Drafts included. */
export function findPostBySlug(slug: string): Promise<PostRow | null> {
  return db().post.findFirst({ where: { slug, deletedAt: null }, include: withAuthor });
}

/** Slugs already in use that `base` could collide with: `base` and `base-…`. */
async function slugsLike(base: string): Promise<string[]> {
  const rows = await db().post.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

function isSlugConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  return JSON.stringify(error.meta ?? {}).includes("slug");
}

export type NewPost = {
  authorId: string;
  title: string;
  description: string | null;
  excerpt: string;
  readingMinutes: number;
  content: PostContent;
};

/**
 * Inserts a draft under the first free slug from `baseSlug`. The unique index
 * is the final word: if a concurrent request takes the slug first, try the
 * next one.
 */
export async function createPost(baseSlug: string, data: NewPost): Promise<PostRow> {
  for (let attempt = 1; ; attempt++) {
    const slug = firstFreeSlug(baseSlug, await slugsLike(baseSlug));
    try {
      return await db().post.create({
        data: { ...data, content: data.content as Prisma.InputJsonValue, slug },
        include: withAuthor,
      });
    } catch (error) {
      if (!isSlugConflict(error) || attempt >= 5) throw error;
    }
  }
}

export type PostChanges = {
  title?: string;
  description?: string | null;
  excerpt?: string;
  readingMinutes?: number;
  content?: PostContent;
  editedAt?: Date;
};

/** Updates the given fields. The slug is never among them. */
export function updatePost(id: string, changes: PostChanges): Promise<PostRow> {
  const { content, ...rest } = changes;
  return db().post.update({
    where: { id },
    data: { ...rest, ...(content && { content: content as Prisma.InputJsonValue }) },
    include: withAuthor,
  });
}

/**
 * Publishes the post at `at` unless it is already published. The condition is
 * part of the UPDATE, so concurrent publishes can't move `publishedAt` once it
 * is set. Returns the post as it stands afterwards.
 */
export async function publishPost(id: string, at: Date): Promise<PostRow> {
  await db().post.updateMany({ where: { id, publishedAt: null }, data: { publishedAt: at } });
  return db().post.findUniqueOrThrow({ where: { id }, include: withAuthor });
}

const summaryFields = {
  id: true,
  slug: true,
  title: true,
  description: true,
  excerpt: true,
  coverUrl: true,
  readingMinutes: true,
  publishedAt: true,
  editedAt: true,
  ...withAuthor,
} as const;

export type PostSummaryRow = Prisma.PostGetPayload<{ select: typeof summaryFields }> & {
  publishedAt: Date;
};

/**
 * One page of published, non-deleted posts, newest published first, starting
 * after `after` (keyset paging on publishedAt, then id). Tag and profile
 * lists narrow it with `where`.
 */
export async function findPublishedPage(
  after: FeedPosition | null,
  take: number,
  where: Prisma.PostWhereInput = {},
): Promise<PostSummaryRow[]> {
  const rows = await db().post.findMany({
    where: {
      AND: [
        where,
        { publishedAt: { not: null }, deletedAt: null },
        after
          ? {
              OR: [
                { publishedAt: { lt: after.publishedAt } },
                { publishedAt: after.publishedAt, id: { lt: after.id } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take,
    select: summaryFields,
  });
  return rows as PostSummaryRow[];
}
