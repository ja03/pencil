// Shared by the API and the client: post request and response shapes.
import { z } from "zod";
import { checkPostContent, type PostContent } from "./post-content";
import { postTags } from "./tags";

export type { PostContent } from "./post-content";

export const TITLE_MAX_LENGTH = 150;
export const DESCRIPTION_MAX_LENGTH = 200;

const title = z
  .string("Add a title.")
  .trim()
  .min(1, "Add a title.")
  .max(TITLE_MAX_LENGTH, `Keep the title to ${TITLE_MAX_LENGTH} characters.`);

/** Optional; blank means "use the start of the post". */
const description = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX_LENGTH, `Keep the description to ${DESCRIPTION_MAX_LENGTH} characters.`)
  .nullish()
  .transform((d) => (d ? d : null));

/** Tiptap JSON, held to the whitelist in `post-content.ts`. */
export const postContent = z.unknown().transform((value, ctx): PostContent => {
  const result = checkPostContent(value);
  if (result.ok) return result.content;
  ctx.issues.push({ code: "custom", message: result.issue.message, input: value });
  return z.NEVER;
});

export const createPostInput = z.object({
  title,
  description,
  content: postContent,
  tags: postTags.default([]),
});
export type CreatePostInput = z.infer<typeof createPostInput>;
/** What the editor sends; the content is checked on the server. */
export type CreatePostBody = z.input<typeof createPostInput>;

export const updatePostInput = z.object({
  title: title.optional(),
  description: description.optional(),
  content: postContent.optional(),
  /** Replaces every tag on the post; leave it out to keep them. */
  tags: postTags.optional(),
});
export type UpdatePostInput = z.infer<typeof updatePostInput>;
export type UpdatePostBody = z.input<typeof updatePostInput>;

export type PostAuthor = { id: string; username: string };

export type PostStatus = "draft" | "published";

/** A post as its author (or, once published, any reader) sees it. */
export type Post = {
  id: string;
  /** Fixed when the post is created; title edits never change it. */
  slug: string;
  title: string;
  /** What the author wrote, or null when they left it blank. */
  description: string | null;
  /** The description, or the start of the content when there is none. */
  summary: string;
  content: PostContent;
  /** Sanitized HTML rendered from `content` on the server. */
  html: string;
  coverUrl: string | null;
  /** Estimated minutes to read, at least 1. */
  readingMinutes: number;
  /** Normalized tag names, in the author's order. At most 5. */
  tags: string[];
  status: PostStatus;
  /** Set the first time the post is published and never changed after. */
  publishedAt: string | null;
  /** When it was last edited after publishing; shown as an "edited" label. */
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
};

/** Body of create, read, update and publish responses. */
export type PostResponse = { post: Post };

/** Posts per feed page. */
export const FEED_PAGE_SIZE = 10;

/** A published post as a feed card shows it: no body, so pages stay small. */
export type PostSummary = Pick<
  Post,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "coverUrl"
  | "readingMinutes"
  | "tags"
  | "editedAt"
  | "author"
> & { publishedAt: string };

/**
 * One page of a post list, newest published first. Pass `nextCursor` back as
 * `?cursor=` for the next page; null means there are no more.
 */
export type FeedResponse = { posts: PostSummary[]; nextCursor: string | null };
