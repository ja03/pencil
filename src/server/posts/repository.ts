import { Prisma } from "@/generated/prisma/client";
import type { PostContent } from "@/contracts/post-content";
import { db } from "@/server/db";
import { firstFreeSlug } from "./slug";

const withAuthor = { author: { select: { id: true, username: true } } } as const;

export type PostRow = Prisma.PostGetPayload<{ include: typeof withAuthor }>;

/** A post that hasn't been deleted, with its author. Drafts included. */
export function findPostById(id: string): Promise<PostRow | null> {
  return db().post.findFirst({ where: { id, deletedAt: null }, include: withAuthor });
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
  content?: PostContent;
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
