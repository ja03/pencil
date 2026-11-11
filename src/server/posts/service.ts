import type { CurrentUser } from "@/contracts/auth";
import type { PostContent } from "@/contracts/post-content";
import type { CreatePostInput, Post, UpdatePostInput } from "@/contracts/posts";
import { ApiError } from "@/server/http/errors";
import { excerptOf } from "./excerpt";
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
    status: row.publishedAt ? "published" : "draft",
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: row.author,
  };
}

/**
 * The post if `viewer` may see it, otherwise null. A draft is visible only to
 * its author; to everyone else it doesn't exist (404, never 403), so drafts
 * don't leak even their existence.
 */
async function findVisible(viewer: CurrentUser | null, id: string) {
  const row = await posts.findPostById(id);
  if (!row) return null;
  if (!row.publishedAt && row.authorId !== viewer?.id) return null;
  return row;
}

/** Saves a new draft. Any signed-in user may write drafts, verified or not. */
export async function createDraft(author: CurrentUser, input: CreatePostInput): Promise<Post> {
  const row = await posts.createPost(slugify(input.title), {
    authorId: author.id,
    title: input.title,
    description: input.description,
    excerpt: excerptOf(input.content),
    content: input.content,
  });
  return toPost(row);
}

export async function getPost(viewer: CurrentUser | null, id: string): Promise<Post> {
  const row = await findVisible(viewer, id);
  if (!row) throw new ApiError("NOT_FOUND", NOT_FOUND);
  return toPost(row);
}

/** The post when `user` wrote it, otherwise null. For the editor page. */
export async function findOwnPost(user: CurrentUser, id: string): Promise<Post | null> {
  const row = await posts.findPostById(id);
  return row && row.authorId === user.id ? toPost(row) : null;
}

/**
 * Edits a post's title, description or content. The slug never changes.
 * Only the author may edit: others get 404 for a draft and 403 for a
 * published post.
 */
export async function updatePost(
  user: CurrentUser,
  id: string,
  input: UpdatePostInput,
): Promise<Post> {
  const row = await findVisible(user, id);
  if (!row) throw new ApiError("NOT_FOUND", NOT_FOUND);
  if (row.authorId !== user.id) {
    throw new ApiError("FORBIDDEN", "Only the author can edit this post.");
  }
  const updated = await posts.updatePost(id, {
    title: input.title,
    description: input.description,
    ...(input.content && { content: input.content, excerpt: excerptOf(input.content) }),
  });
  return toPost(updated);
}
