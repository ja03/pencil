import { Prisma } from "@/generated/prisma/client";
import type { PostContent } from "@/contracts/post-content";
import { db } from "@/server/db";
import type { KeysetPosition } from "@/server/http/cursor";
import { firstFreeSlug } from "./slug";

const author = { author: { select: { id: true, username: true } } } as const;

/** A post's tag names, in the author's order. */
const tagNames = {
  tags: { select: { tag: { select: { name: true } } }, orderBy: { position: "asc" } },
} as const;

/**
 * How many readers like the post and how many comments it has, as `_count`.
 * Deleted comments don't count: the number matches what the thread shows.
 */
const counts = {
  _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
} as const;

const withAuthorAndTags = { ...author, ...tagNames, ...counts } as const;

export type PostRow = Prisma.PostGetPayload<{ include: typeof withAuthorAndTags }>;

/** A post that hasn't been deleted, with its author. Drafts included. */
export function findPostById(id: string): Promise<PostRow | null> {
  return db().post.findFirst({ where: { id, deletedAt: null }, include: withAuthorAndTags });
}

/** A post that hasn't been deleted, by its slug, with its author. Drafts included. */
export function findPostBySlug(slug: string): Promise<PostRow | null> {
  return db().post.findFirst({ where: { slug, deletedAt: null }, include: withAuthorAndTags });
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

/**
 * The ids of the tags called `names`, creating any that don't exist yet.
 * ON CONFLICT DO NOTHING makes concurrent posts adding the same new tag safe.
 */
async function tagIdsFor(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  await db().tag.createMany({ data: names.map((name) => ({ name })), skipDuplicates: true });
  const rows = await db().tag.findMany({ where: { name: { in: names } } });
  const ids = new Map(rows.map((row) => [row.name, row.id]));
  return names.map((name) => ids.get(name)!);
}

/** Nested-write rows linking a post to `names`, keeping their order. */
async function postTagRows(names: string[]) {
  return (await tagIdsFor(names)).map((tagId, position) => ({ tagId, position }));
}

export type NewPost = {
  authorId: string;
  title: string;
  description: string | null;
  /** An uploaded image in Pencil's storage, or null for the generated cover. */
  coverUrl: string | null;
  excerpt: string;
  readingMinutes: number;
  content: PostContent;
  /** Normalized tag names, in order. */
  tags: string[];
};

/**
 * Inserts a draft under the first free slug from `baseSlug`. The unique index
 * is the final word: if a concurrent request takes the slug first, try the
 * next one.
 */
export async function createPost(baseSlug: string, data: NewPost): Promise<PostRow> {
  const { tags, ...fields } = data;
  const tagRows = await postTagRows(tags);
  for (let attempt = 1; ; attempt++) {
    const slug = firstFreeSlug(baseSlug, await slugsLike(baseSlug));
    try {
      return await db().post.create({
        data: {
          ...fields,
          content: fields.content as Prisma.InputJsonValue,
          slug,
          tags: { create: tagRows },
        },
        include: withAuthorAndTags,
      });
    } catch (error) {
      if (!isSlugConflict(error) || attempt >= 5) throw error;
    }
  }
}

export type PostChanges = {
  title?: string;
  description?: string | null;
  coverUrl?: string | null;
  excerpt?: string;
  readingMinutes?: number;
  content?: PostContent;
  /** Replaces every tag on the post. */
  tags?: string[];
  editedAt?: Date;
};

/**
 * Updates the given fields. The slug is never among them. A new tag list
 * replaces the old one in the same statement as the other changes.
 */
export async function updatePost(id: string, changes: PostChanges): Promise<PostRow> {
  const { content, tags, ...rest } = changes;
  return db().post.update({
    where: { id },
    data: {
      ...rest,
      ...(content && { content: content as Prisma.InputJsonValue }),
      ...(tags && { tags: { deleteMany: {}, create: await postTagRows(tags) } }),
    },
    include: withAuthorAndTags,
  });
}

/**
 * Publishes the post at `at` unless it is already published. The condition is
 * part of the UPDATE, so concurrent publishes can't move `publishedAt` once it
 * is set. Returns the post as it stands afterwards.
 */
export async function publishPost(id: string, at: Date): Promise<PostRow> {
  await db().post.updateMany({ where: { id, publishedAt: null }, data: { publishedAt: at } });
  return db().post.findUniqueOrThrow({ where: { id }, include: withAuthorAndTags });
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
  ...withAuthorAndTags,
} as const;

/** What a post list can be narrowed to. */
export type PostListFilter = {
  /** Only posts with this (normalized) tag. */
  tag?: string;
  /** Only posts by this author. */
  authorId?: string;
};

const PUBLISHED = { publishedAt: { not: null }, deletedAt: null } as const;

export type PostSummaryRow = Prisma.PostGetPayload<{ select: typeof summaryFields }> & {
  publishedAt: Date;
};

/**
 * One page of published, non-deleted posts, newest published first, starting
 * after `after` (keyset paging on publishedAt, then id). Tag and profile pages
 * narrow it with `filter`.
 */
export async function findPublishedPage(
  after: KeysetPosition | null,
  take: number,
  filter: PostListFilter = {},
): Promise<PostSummaryRow[]> {
  const rows = await db().post.findMany({
    where: {
      AND: [
        filter.tag ? { tags: { some: { tag: { name: filter.tag } } } } : {},
        filter.authorId ? { authorId: filter.authorId } : {},
        PUBLISHED,
        after
          ? {
              OR: [
                { publishedAt: { lt: after.at } },
                { publishedAt: after.at, id: { lt: after.id } },
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

/** Whether `id` is a published post that hasn't been deleted. Reads no post fields. */
export async function isPublished(id: string): Promise<boolean> {
  return (await db().post.count({ where: { id, ...PUBLISHED } })) > 0;
}

/** How many published, non-deleted posts carry `tag`. */
export function countPublishedWithTag(tag: string): Promise<number> {
  return db().post.count({ where: { ...PUBLISHED, tags: { some: { tag: { name: tag } } } } });
}

/** How many published, non-deleted posts `authorId` has. */
export function countPublishedBy(authorId: string): Promise<number> {
  return db().post.count({ where: { ...PUBLISHED, authorId } });
}

const ownListFields = {
  id: true,
  slug: true,
  title: true,
  coverUrl: true,
  publishedAt: true,
  updatedAt: true,
} as const;

export type OwnPostRow = Prisma.PostGetPayload<{ select: typeof ownListFields }>;

/**
 * Every draft and published post by `authorId` that hasn't been deleted,
 * most recently changed first.
 */
export function findOwnPosts(authorId: string): Promise<OwnPostRow[]> {
  return db().post.findMany({
    where: { authorId, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: ownListFields,
  });
}

/**
 * Marks the post deleted at `at`. The row, its tags and its slug stay; every
 * read filters on `deletedAt`, so it is gone everywhere at once.
 */
export async function softDeletePost(id: string, at: Date): Promise<void> {
  await db().post.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: at } });
}

export type TagUsage = { name: string; postCount: number };

/** `text` with LIKE's wildcards escaped, so it matches only itself. */
function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Tags whose name starts with `prefix`, with how many published,
 * non-deleted posts use each; most used first. Tags used only on drafts or
 * deleted posts are left out, so a private draft never leaks its tags.
 */
export function findTagsByPrefix(prefix: string, take: number): Promise<TagUsage[]> {
  return db().$queryRaw<TagUsage[]>`
    SELECT t.name, COUNT(*)::int AS "postCount"
    FROM tags t
    JOIN post_tags pt ON pt."tagId" = t.id
    JOIN posts p ON p.id = pt."postId"
    WHERE p."publishedAt" IS NOT NULL
      AND p."deletedAt" IS NULL
      AND t.name LIKE ${likeLiteral(prefix) + "%"}
    GROUP BY t.name
    ORDER BY "postCount" DESC, t.name ASC
    LIMIT ${take}`;
}
