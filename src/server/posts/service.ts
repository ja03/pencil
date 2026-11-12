import type { CurrentUser } from "@/contracts/auth";
import type { PostContent } from "@/contracts/post-content";
import {
  FEED_PAGE_SIZE,
  type CreatePostInput,
  type FeedResponse,
  type MyPost,
  type MyPostsResponse,
  type Post,
  type PostSummary,
  type UpdatePostInput,
} from "@/contracts/posts";
import { normalizeTag, TAG_SUGGESTION_LIMIT, type TagSuggestionsResponse } from "@/contracts/tags";
import { clock } from "@/server/clock";
import { embedAfterResponse, reembedAfterResponse } from "@/server/embeddings/service";
import { changesEmbedding, type EmbeddingSource } from "@/server/embeddings/text";
import { ApiError } from "@/server/http/errors";
import { hasLiked, likedAmong } from "@/server/likes/repository";
import { findUserByUsername } from "@/server/users/repository";
import { encodeCursor, type KeysetPosition } from "@/server/http/cursor";
import { excerptOf } from "./excerpt";
import { readingMinutesOf } from "./reading-time";
import { renderPostContent } from "./render";
import * as posts from "./repository";
import { slugify } from "./slug";

const NOT_FOUND = "That post doesn't exist.";

const namesOf = (tags: { tag: { name: string } }[]) => tags.map((t) => t.tag.name);

const embeddingSourceOf = (row: posts.PostRow): EmbeddingSource => ({
  title: row.title,
  description: row.description,
  tags: namesOf(row.tags),
});

function toPost(row: posts.PostRow, likedByViewer: boolean): Post {
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
    tags: namesOf(row.tags),
    status: row.publishedAt ? "published" : "draft",
    publishedAt: row.publishedAt?.toISOString() ?? null,
    editedAt: row.editedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: row.author,
    likeCount: row._count.likes,
    likedByViewer,
    commentCount: row._count.comments,
  };
}

/** The post as `viewer` sees it, including whether they like it. */
async function present(viewer: CurrentUser | null, row: posts.PostRow): Promise<Post> {
  return toPost(row, viewer ? await hasLiked(viewer.id, row.id) : false);
}

function toSummary(row: posts.PostSummaryRow, likedByViewer: boolean): PostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.description ?? row.excerpt,
    coverUrl: row.coverUrl,
    readingMinutes: row.readingMinutes,
    tags: namesOf(row.tags),
    publishedAt: row.publishedAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    author: row.author,
    likeCount: row._count.likes,
    likedByViewer,
    commentCount: row._count.comments,
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
    coverUrl: input.coverUrl,
    excerpt: excerptOf(input.content),
    readingMinutes: readingMinutesOf(input.content),
    content: input.content,
    tags: input.tags,
  });
  return toPost(row, false);
}

export async function getPost(viewer: CurrentUser | null, id: string): Promise<Post> {
  const row = visibleTo(viewer, await posts.findPostById(id));
  if (!row) throw new ApiError("NOT_FOUND", NOT_FOUND);
  return present(viewer, row);
}

/** The post at `slug` if `viewer` may see it, otherwise null. For the post page. */
export async function findPostBySlug(
  viewer: CurrentUser | null,
  slug: string,
): Promise<Post | null> {
  const row = visibleTo(viewer, await posts.findPostBySlug(slug));
  return row && present(viewer, row);
}

/** The post when `user` wrote it, otherwise null. For the editor page. */
export async function findOwnPost(user: CurrentUser, id: string): Promise<Post | null> {
  const row = await posts.findPostById(id);
  return row && row.authorId === user.id ? present(user, row) : null;
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

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * Edits a post's title, description, cover, content or tags. The slug never changes, and
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
    (input.coverUrl !== undefined && input.coverUrl !== row.coverUrl) ||
    (input.content !== undefined && !sameJson(input.content, row.content)) ||
    (input.tags !== undefined && !sameList(input.tags, namesOf(row.tags)));
  const updated = await posts.updatePost(id, {
    title: input.title,
    description: input.description,
    coverUrl: input.coverUrl,
    ...(input.content && {
      content: input.content,
      excerpt: excerptOf(input.content),
      readingMinutes: readingMinutesOf(input.content),
    }),
    tags: input.tags,
    ...(changed && row.publishedAt && { editedAt: clock.now() }),
  });
  // Drafts are embedded when they are published, so only published posts re-embed.
  if (updated.publishedAt && changesEmbedding(embeddingSourceOf(row), embeddingSourceOf(updated))) {
    await reembedAfterResponse(id);
  }
  return present(user, updated);
}

/**
 * Publishes the author's post. Only verified users may publish. `publishedAt`
 * is set the first time and never moves, so publishing again is a no-op.
 */
export async function publishPost(user: CurrentUser, id: string): Promise<Post> {
  const row = await findOwnForChange(user, id, "publish");
  if (!user.emailVerified) throw new ApiError("FORBIDDEN", "Verify your email to publish.");
  if (row.publishedAt) return present(user, row);
  const published = await posts.publishPost(id, clock.now());
  embedAfterResponse(id);
  return present(user, published);
}

/**
 * Deletes the author's post, draft or published. It is a soft delete: the
 * post is 404 everywhere from then on but the row stays. Only the author may
 * delete: others get 404 for a draft and 403 for a published post.
 */
export async function deletePost(user: CurrentUser, id: string): Promise<void> {
  await findOwnForChange(user, id, "delete");
  await posts.softDeletePost(id, clock.now());
}

function toMyPost(row: posts.OwnPostRow): MyPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    coverUrl: row.coverUrl,
    status: row.publishedAt ? "published" : "draft",
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The My posts dashboard: every draft and published post `user` has, latest change first. */
export async function listOwnPosts(user: CurrentUser): Promise<MyPostsResponse> {
  return { posts: (await posts.findOwnPosts(user.id)).map(toMyPost) };
}

/**
 * One page of an author's published posts, for their profile. Null when
 * nobody has that (normalized) username.
 */
export async function listPublishedBy(
  viewer: CurrentUser | null,
  username: string,
  after: KeysetPosition | null,
): Promise<FeedResponse | null> {
  const author = await findUserByUsername(username);
  return author && listPublished(viewer, after, { authorId: author.id });
}

/**
 * One page of published posts, newest first, after `after` (null for the
 * first page), optionally only those with a tag or by an author. Readable
 * without an account; each card says whether `viewer` likes it.
 */
export async function listPublished(
  viewer: CurrentUser | null,
  after: KeysetPosition | null,
  filter: posts.PostListFilter = {},
): Promise<FeedResponse> {
  // One extra row says whether another page exists without a count query.
  const rows = await posts.findPublishedPage(after, FEED_PAGE_SIZE + 1, filter);
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const last = page.at(-1);
  const liked = viewer ? await likedAmong(viewer.id, page.map((row) => row.id)) : new Set();
  return {
    posts: page.map((row) => toSummary(row, liked.has(row.id))),
    nextCursor:
      rows.length > FEED_PAGE_SIZE && last
        ? encodeCursor({ at: last.publishedAt, id: last.id })
        : null,
  };
}

/**
 * Cards for the published posts among `ids`, in the order given, as `viewer`
 * sees them. Ids of drafts, deleted or unknown posts are dropped.
 */
export async function summariesOf(viewer: CurrentUser | null, ids: string[]): Promise<PostSummary[]> {
  const rows = new Map((await posts.findPublishedSummaries(ids)).map((row) => [row.id, row]));
  const ordered = ids.flatMap((id) => rows.get(id) ?? []);
  const liked = viewer ? await likedAmong(viewer.id, ordered.map((row) => row.id)) : new Set();
  return ordered.map((row) => toSummary(row, liked.has(row.id)));
}

/** How many published posts a tag page lists in all. */
export function countTagged(tag: string): Promise<number> {
  return posts.countPublishedWithTag(tag);
}

/**
 * Existing tags to offer while an author types `query`: those starting with
 * it, most used first; the most used overall when it is blank. Input that
 * can't begin a tag matches nothing.
 */
export async function suggestTags(query: string): Promise<TagSuggestionsResponse> {
  const trimmed = query.trim();
  // A trailing separator ("machine ") is the start of a longer tag.
  const open = /[\s_-]$/.test(trimmed);
  const base = trimmed.replace(/[\s_-]+$/, "");
  if (base === "" || base === "#") {
    return { tags: await posts.findTagsByPrefix("", TAG_SUGGESTION_LIMIT) };
  }
  const tag = normalizeTag(base);
  if (!tag) return { tags: [] };
  const prefix = open ? `${tag}-` : tag;
  return { tags: await posts.findTagsByPrefix(prefix, TAG_SUGGESTION_LIMIT) };
}
