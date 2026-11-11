import Link from "next/link";
import { shortDate } from "@/client/format";
import type { PostSummary } from "@/contracts/posts";
import { tagPath } from "@/contracts/tags";
import { profilePath } from "@/contracts/users";
import { HeartIcon, likesLabel } from "./heart-icon";
import { PostCover } from "./post-cover";

/** A feed card: cover, reading time, tags, title, summary, author, date and likes. */
export function PostCard({ post }: { post: PostSummary }) {
  const href = `/posts/${post.slug}`;
  return (
    <article className="flex h-full flex-col gap-3.5 rounded-[18px] border border-line bg-surf p-2.5 text-ink">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[16/10] overflow-hidden rounded-xl"
      >
        <PostCover post={post} glyphClassName="text-[150px] sm:text-[170px]" />
        <span className="label-mono absolute top-2.5 left-2.5 rounded-full bg-[rgba(28,21,16,0.55)] px-[9px] py-[5px] text-[10px] text-[#FBF4E8]">
          {post.readingMinutes} min read
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 px-1.5 pb-1.5">
        {post.tags.length > 0 && (
          <ul aria-label="Tags" className="m-0 flex list-none flex-wrap gap-x-2.5 gap-y-1 p-0">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={tagPath(tag)}
                  className="label-mono text-[10px] tracking-[0.08em] text-acc no-underline hover:underline"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <h3 className="m-0 font-serif text-2xl leading-[1.15] font-normal tracking-[-0.01em]">
          <Link href={href} className="text-ink no-underline hover:underline">
            {post.title}
          </Link>
        </h3>
        <p className="m-0 line-clamp-2 text-sm leading-[1.55] text-mut">{post.summary}</p>
        <div className="mt-auto flex min-w-0 items-center gap-2 pt-1.5 text-xs text-mut">
          <span
            aria-hidden="true"
            className="flex size-[26px] flex-none items-center justify-center rounded-full bg-soft font-serif text-[13px] text-ink"
          >
            {post.author.username.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">
            <Link href={profilePath(post.author.username)} className="text-ink no-underline hover:underline">
              @{post.author.username}
            </Link>{" "}
            ·{" "}
            <time dateTime={post.publishedAt}>{shortDate(post.publishedAt)}</time>
            <span className="sr-only">, {post.readingMinutes} min read</span>
          </span>
          <span className="ml-auto flex flex-none items-center gap-1 tabular-nums">
            <HeartIcon filled={false} size={14} />
            <span aria-hidden="true">{post.likeCount}</span>
            <span className="sr-only">{likesLabel(post.likeCount)}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

/** A card-shaped placeholder while posts load. */
export function PostCardSkeleton() {
  const bar = "rounded-md bg-soft";
  return (
    <div aria-hidden="true" className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surf p-2.5">
      <div className="aspect-[16/10] rounded-xl bg-soft" />
      <div className="flex flex-col gap-2.5 px-1.5 pb-2.5">
        <div className={`${bar} h-[18px] w-[90%]`} />
        <div className={`${bar} h-[18px] w-[70%]`} />
        <div className={`${bar} mt-2.5 h-2.5 w-1/2`} />
      </div>
    </div>
  );
}
