import type { CurrentUser } from "@/contracts/auth";
import type { PostContent } from "@/contracts/post-content";
import {
  FEED_PAGE_SIZE,
  type CreatePostInput,
  type FeedResponse,
  type Post,
  type PostSummary,
  type UpdatePostInput,
} from "@/contracts/posts";
import { clock } from "@/server/clock";
import { ApiError } from "@/server/http/errors";
import { encodeCursor, type FeedPosition } from "./cursor";
import { excerptOf } from "./excerpt";
import { readingMinutesOf } from "./reading-time";
import { renderPostContent } from "./render";
import * as posts from "./repository";
import { slugify } from "./slug";

const NOT_FOUND = "That post doesn't exist.";

function toPost(row: posts.PostRow): Post {
  const content = row.content as PostContent;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    summary: row.description ?? row.excerpt,
    content,
    html: renderPostContent(content),
    coverUrl: row.coverUrl,
    readingMinutes: row.readingMinutes,
    status: row.publishedAt ? "published" : "draft",
    publishedAt: row.publishedAt?.toISOString() ?? null,
    editedAt: row.editedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: row.author,
  };
}

function toSummary(row: posts.PostSummaryRow): PostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.description ?? row.excerpt,
    coverUrl: row.coverUrl,
    readingMinutes: row.readingMinutes,
    publishedAt: row.publishedAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    author: row.author,
  };
}

/**
 * The post if `viewer` may see it, otherwise null. A draft is visible only to
 * its author; to everyone else it doesn't exist (404, never 403), so drafts
 * don't leak even their existence.
 */
function visibleTo(viewer: CurrentUser | null, row: posts.PostRow | null) {
  if (!row) return null;
  if (!row.publishedAt && row.authorId !== viewer?.id) return null;
  return row;
}

/** Like `visibleTo`, plus only the author may change the post: 403 for anyone else. */
async function findOwnForChange(user: CurrentUser, id: string, action: string) {
  const row = visibleTo(user, await posts.findPostById(id));
  if (!row) throw new ApiError("NOT_FOUND", NOT_FOUND);
  if (row.authorId !== user.id) {
    throw new ApiError("FORBIDDEN", `Only the author can ${action} this post.`);
  }
  return row;
}

/** Saves a new draft. Any signed-in user may write drafts, verified or not. */
export async function createDraft(author: CurrentUser, input: CreatePostInput): Promise<Post> {
  const row = await posts.createPost(slugify(input.title), {
    authorId: author.id,
    title: input.title,
    description: input.description,
    excerpt: excerptOf(input.content),
    readingMinutes: readingMinutesOf(input.content),
    content: input.content,
  });
  return toPost(row);
}

export async function getPost(viewer: CurrentUser | null, id: string): Promise<Post> {
  const row = visibleTo(viewer, await posts.findPostById(id));
  if (!row) throw new ApiError("NOT_FOUND", NOT_FOUND);
  return toPost(row);
}

/** The post at `slug` if `viewer` may see it, otherwise null. For the post page. */
export async function findPostBySlug(
  viewer: CurrentUser | null,
  slug: string,
): Promise<Post | null> {
  const row = visibleTo(viewer, await posts.findPostBySlug(slug));
  return row && toPost(row);
}

/** The post when `user` wrote it, otherwise null. For the editor page. */
export async function findOwnPost(user: CurrentUser, id: string): Promise<Post | null> {
  const row = await posts.findPostById(id);
  return row && row.authorId === user.id ? toPost(row) : null;
}

/** JSON equality that ignores key order (Postgres jsonb reorders keys). */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) =>
    sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * Edits a post's title, description or content. The slug never changes, and
 * neither does `publishedAt`: an actual change to a published post marks it
 * edited instead. Only the author may edit: others get 404 for a draft and
 * 403 for a published post.
 */
export async function updatePost(
  user: CurrentUser,
  id: string,
  input: UpdatePostInput,
): Promise<Post> {
  const row = await findOwnForChange(user, id, "edit");
  const changed =
    (input.title !== undefined && input.title !== row.title) ||
    (input.description !== undefined && input.description !== row.description) ||
    (input.content !== undefined && !sameJson(input.content, row.content));
  const updated = await posts.updatePost(id, {
    title: input.title,
    description: input.description,
    ...(input.content && {
      content: input.content,
      excerpt: excerptOf(input.content),
      readingMinutes: readingMinutesOf(input.content),
    }),
    ...(changed && row.publishedAt && { editedAt: clock.now() }),
  });
  return toPost(updated);
}

/**
 * Publishes the author's post. Only verified users may publish. `publishedAt`
 * is set the first time and never moves, so publishing again is a no-op.
 */
export async function publishPost(user: CurrentUser, id: string): Promise<Post> {
  const row = await findOwnForChange(user, id, "publish");
  if (!user.emailVerified) throw new ApiError("FORBIDDEN", "Verify your email to publish.");
  if (row.publishedAt) return toPost(row);
  return toPost(await posts.publishPost(id, clock.now()));
}

/**
 * One page of published posts, newest first, after `after` (null for the
 * first page). Readable without an account.
 */
export async function listPublished(after: FeedPosition | null): Promise<FeedResponse> {
  // One extra row says whether another page exists without a count query.
  const rows = await posts.findPublishedPage(after, FEED_PAGE_SIZE + 1);
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const last = page.at(-1);
  return {
    posts: page.map(toSummary),
    nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeCursor(last) : null,
  };
}
