import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { longDate } from "@/client/format";
import { CommentIcon, commentsLabel } from "@/components/comment-icon";
import { CommentsSection } from "@/components/comments-section";
import { LikeButton } from "@/components/like-button";
import { PostCover } from "@/components/post-cover";
import type { CommentsResponse } from "@/contracts/comments";
import type { Post } from "@/contracts/posts";
import { tagPath } from "@/contracts/tags";
import { profilePath } from "@/contracts/users";
import { getCurrentUser } from "@/server/auth/service";
import { listComments } from "@/server/comments/service";
import { findPostBySlug } from "@/server/posts/service";

type Props = PageProps<"/posts/[slug]">;

/** Title and summary for the tab and link previews. Published posts only. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await findPostBySlug(null, (await params).slug);
  if (!post) return { title: "Pencil" };
  return { title: `${post.title} · Pencil`, description: post.summary };
}

/**
 * A post, rendered on the server. Drafts are visible only to their author;
 * for everyone else they, deleted posts and unknown slugs are a 404.
 */
export default function PostPage({ params }: Props) {
  return (
    <Suspense fallback={<PostSkeleton />}>
      <PostView params={params} />
    </Suspense>
  );
}

async function PostView({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const viewer = await getCurrentUser(await cookies());
  const post = await findPostBySlug(viewer, slug);
  if (!post) notFound();
  // Drafts have no comments: nobody can comment until the post is published.
  const comments = post.status === "published" ? await listComments(post.id, null) : null;
  return (
    <PostArticle post={post} comments={comments} isAuthor={viewer?.id === post.author.id} />
  );
}

function PostArticle({
  post,
  comments,
  isAuthor,
}: {
  post: Post;
  comments: CommentsResponse | null;
  isAuthor: boolean;
}) {
  const draft = post.status === "draft";
  return (
    <main className="box-border flex flex-col items-center gap-9 px-4 pt-6 pb-16 sm:gap-14 sm:px-10 sm:pt-12 sm:pb-28">
      {draft && (
        <p
          role="note"
          className="m-0 flex w-full max-w-[760px] flex-wrap items-center justify-between gap-2 rounded-xl bg-soft px-4 py-3 text-sm"
        >
          This is a draft. Only you can see it.
          <Link href={`/write/${post.id}`} className="font-semibold text-ink">
            Keep editing
          </Link>
        </p>
      )}

      <header className="flex w-full max-w-[760px] flex-col gap-[22px]">
        {post.tags.length > 0 && (
          <ul aria-label="Tags" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={tagPath(tag)}
                  className="label-mono flex min-h-8 items-center rounded-full border border-line px-3 text-[11px] tracking-[0.08em] text-acc no-underline hover:bg-soft"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <h1 className="m-0 font-serif text-[40px] leading-[1.04] font-normal tracking-[-0.02em] break-words sm:text-[64px]">
          {post.title}
        </h1>
        {post.description && (
          <p className="m-0 font-serif text-[19px] leading-[1.45] text-mut italic sm:text-[23px]">
            {post.description}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-y border-line py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 flex-none items-center justify-center rounded-full bg-acc font-serif text-xl text-bg"
            >
              {post.author.username.charAt(0).toUpperCase()}
            </span>
            <span className="flex flex-col gap-0.5">
              <Link
                href={profilePath(post.author.username)}
                className="text-[15px] font-medium text-ink no-underline hover:underline"
              >
                @{post.author.username}
              </Link>
              <span className="text-[13px] text-mut">
                {post.publishedAt ? (
                  <>
                    Published <time dateTime={post.publishedAt}>{longDate(post.publishedAt)}</time>
                  </>
                ) : (
                  "Not published yet"
                )}{" "}
                · {post.readingMinutes} min read
                {post.editedAt && (
                  <>
                    {" · "}
                    <time dateTime={post.editedAt} title={`Edited ${longDate(post.editedAt)}`}>
                      Edited
                    </time>
                  </>
                )}
              </span>
            </span>
          </div>
          {!draft && (
            <div className="flex items-center gap-2">
              <LikeButton
                postId={post.id}
                initial={{ liked: post.likedByViewer, likeCount: post.likeCount }}
              />
              <a
                href="#comments"
                aria-label={`Comments, ${commentsLabel(post.commentCount)}`}
                className="label-mono flex h-11 items-center gap-2 rounded-full border border-line px-4 tracking-[0.1em] text-ink no-underline hover:bg-soft"
              >
                <CommentIcon />
                <span className="tabular-nums">{post.commentCount}</span>
              </a>
              {isAuthor && (
                <Link
                  href={`/write/${post.id}`}
                  className="label-mono flex h-11 items-center rounded-full border border-line px-4 tracking-[0.1em] text-ink no-underline"
                >
                  Edit post
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      <figure className="relative m-0 aspect-[4/3] w-full max-w-[1080px] overflow-hidden rounded-2xl sm:aspect-[21/9] sm:rounded-3xl">
        <PostCover post={post} glyphClassName="text-[220px] sm:text-[420px]" />
      </figure>

      <article
        className="post-prose w-full max-w-[680px] sm:text-[20px]"
        // Built on the server from whitelisted JSON, with every value escaped.
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      {comments && (
        <CommentsSection postId={post.id} initial={comments} initialCount={post.commentCount} />
      )}
    </main>
  );
}

function PostSkeleton() {
  const bar = "rounded-lg bg-soft";
  return (
    <div
      aria-busy="true"
      aria-label="Loading post"
      className="flex flex-col items-center gap-9 px-4 pt-6 sm:gap-14 sm:px-10 sm:pt-12"
    >
      <div className="flex w-full max-w-[760px] flex-col gap-[22px]">
        <span className={`${bar} h-14 w-4/5`} />
        <span className={`${bar} h-7 w-3/5`} />
        <span className={`${bar} h-[78px] w-full`} />
      </div>
      <span className={`${bar} aspect-[4/3] w-full max-w-[1080px] rounded-3xl sm:aspect-[21/9]`} />
    </div>
  );
}
