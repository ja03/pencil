import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FeedList, FeedSkeleton } from "@/components/feed-list";
import { normalizeTag, tagPath } from "@/contracts/tags";
import { getCurrentUser } from "@/server/auth/service";
import { linkPreview } from "@/server/link-preview";
import { countTagged, listPublished } from "@/server/posts/service";

type Props = PageProps<"/tags/[tag]">;

const mono = "label-mono tracking-[0.1em]";

/** A URL segment as text, whether or not it arrives percent-encoded. */
function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The tag a URL segment names, or null when it can't be one. */
function tagOf(segment: string): string | null {
  return normalizeTag(decoded(segment));
}

/** Title and summary for the tab and link previews. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = tagOf((await params).tag);
  if (!tag) return { title: "Pencil" };
  const count = await countTagged(tag);
  const posts = count > 0 ? `${count} ${count === 1 ? "post" : "posts"}` : "Posts";
  return linkPreview({
    title: `#${tag}`,
    previewTitle: `#${tag} on Pencil`,
    description: `${posts} tagged ${tag} on Pencil, newest first.`,
    path: tagPath(tag),
  });
}

/**
 * Every published post with a tag, newest first, rendered on the server and
 * paged like the feed. `/tags/React` redirects to `/tags/react`.
 */
export default function TagPage({ params }: Props) {
  return (
    <main className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-8 px-4 pt-6 pb-16 sm:gap-12 sm:px-10 sm:pb-28">
      <Suspense fallback={<TagSkeleton />}>
        <TagView params={params} />
      </Suspense>
    </main>
  );
}

async function TagView({ params }: Pick<Props, "params">) {
  const { tag: segment } = await params;
  const tag = tagOf(segment);
  if (!tag) notFound();
  // One address per tag: "React" and "%23react" both land on /tags/react.
  if (decoded(segment) !== tag) permanentRedirect(tagPath(tag));
  // Always fresh: read at request time, never prerendered.
  await connection();
  const viewer = await getCurrentUser(await cookies());
  const [first, count] = await Promise.all([
    listPublished(viewer, null, { tag }),
    countTagged(tag),
  ]);

  return (
    <>
      <TagHeader tag={tag} count={count} />
      {first.posts.length === 0 ? (
        <EmptyState
          level={2}
          title={`No posts tagged #${tag}`}
          body="Tags appear as soon as someone uses them. Yours could be the first."
          action={{ href: `/write?tag=${encodeURIComponent(tag)}`, label: "Write with this tag" }}
        />
      ) : (
        <FeedList initial={first} tag={tag} />
      )}
    </>
  );
}

function TagHeader({ tag, count }: { tag: string; count: number }) {
  return (
    <header className="flex flex-col items-center gap-3.5 border-b border-line pt-6 pb-8 text-center sm:pt-16 sm:pb-14">
      <span className={`${mono} rounded-full border border-line px-3.5 py-[7px] text-mut`}>Tag</span>
      <h1 className="m-0 max-w-full font-serif text-[56px] leading-none font-normal tracking-[-0.03em] break-words sm:text-[112px]">
        <span className="text-acc">#</span>
        {tag}
      </h1>
      {count > 0 && (
        <p className="m-0 text-[15px] text-mut">
          {count} published {count === 1 ? "post" : "posts"} tagged {tag}
        </p>
      )}
    </header>
  );
}

function TagSkeleton() {
  return (
    <>
      <div aria-hidden="true" className="flex flex-col items-center gap-3.5 border-b border-line pt-6 pb-8 sm:pt-16 sm:pb-14">
        <span className="h-[30px] w-16 rounded-full bg-soft" />
        <span className="h-14 w-3/5 max-w-[420px] rounded-lg bg-soft sm:h-28" />
      </div>
      <FeedSkeleton />
    </>
  );
}
