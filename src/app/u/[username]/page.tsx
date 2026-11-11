import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { monthYear } from "@/client/format";
import { EmptyState } from "@/components/empty-state";
import { FeedList, FeedSkeleton } from "@/components/feed-list";
import { OwnProfileLink } from "@/components/own-profile-link";
import { normalizeUsername, profilePath, type AuthorProfile } from "@/contracts/users";
import { listPublishedBy } from "@/server/posts/service";
import { findProfile } from "@/server/users/service";

type Props = PageProps<"/u/[username]">;

const mono = "label-mono tracking-[0.1em]";

/** A URL segment as text, whether or not it arrives percent-encoded. */
function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const username = normalizeUsername(decoded((await params).username));
  if (!username) return { title: "Pencil" };
  return {
    title: `@${username} · Pencil`,
    description: `Posts by @${username} on Pencil, newest first.`,
  };
}

/**
 * An author's public profile and their published posts, newest first,
 * rendered on the server and paged like the feed. `/u/Lina_K` redirects to
 * `/u/lina_k`; an unknown username is a 404.
 */
export default function ProfilePage({ params }: Props) {
  return (
    <main className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-10 px-4 pt-4 pb-16 sm:gap-16 sm:px-10 sm:pt-6 sm:pb-28">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileView params={params} />
      </Suspense>
    </main>
  );
}

async function ProfileView({ params }: Pick<Props, "params">) {
  const { username: segment } = await params;
  const username = normalizeUsername(decoded(segment));
  if (!username) notFound();
  // One address per author.
  if (decoded(segment) !== username) permanentRedirect(profilePath(username));
  // Always fresh: read at request time, never prerendered.
  await connection();
  const [profile, first] = await Promise.all([
    findProfile(username),
    listPublishedBy(username, null),
  ]);
  if (!profile || !first) notFound();

  return (
    <>
      <ProfileHeader profile={profile} />
      <section aria-labelledby="posts-title" className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="posts-title" className="m-0 font-serif text-[28px] font-normal break-words sm:text-[36px]">
            Posts by @{profile.username}
          </h2>
          <span className={`${mono} flex-none text-mut`}>Newest first</span>
        </div>
        {first.posts.length === 0 ? (
          <EmptyState
            title="Nothing published yet"
            body={`When @${profile.username} publishes a post, it will show up here.`}
          />
        ) : (
          <FeedList initial={first} author={profile.username} />
        )}
      </section>
    </>
  );
}

function ProfileHeader({ profile }: { profile: AuthorProfile }) {
  const count = profile.publishedCount;
  return (
    <section className="grid grid-cols-1 items-center gap-8 rounded-[28px] border border-line bg-surf px-[22px] py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-16 sm:py-14">
      <div className="order-2 flex min-w-0 flex-col gap-[18px] sm:order-1">
        <span className={`${mono} text-acc`}>Author</span>
        <h1 className="m-0 font-serif text-[44px] leading-none font-normal tracking-[-0.02em] break-words sm:text-[72px]">
          @{profile.username}
        </h1>
        <div className="flex flex-wrap gap-x-7 gap-y-2.5 text-sm text-mut">
          <span>
            <strong className="font-semibold text-ink">{count}</strong>{" "}
            {count === 1 ? "post" : "posts"} published
          </span>
          <span>
            Writing on Pencil since <time dateTime={profile.joinedAt}>{monthYear(profile.joinedAt)}</time>
          </span>
        </div>
        <OwnProfileLink username={profile.username} />
      </div>
      <div
        aria-hidden="true"
        className="order-1 flex size-24 items-center justify-center justify-self-start rounded-full font-serif text-5xl text-[#FBF4E8] sm:order-2 sm:size-[180px] sm:justify-self-end sm:text-[88px]"
        style={{
          background:
            "repeating-linear-gradient(118deg, rgba(255,240,222,0.07) 0 1px, transparent 1px 6px), linear-gradient(150deg, #9A3E1F, #C8683A)",
        }}
      >
        {profile.username.charAt(0).toUpperCase()}
      </div>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <div
        aria-hidden="true"
        className="grid grid-cols-1 items-center gap-8 rounded-[28px] border border-line bg-surf px-[22px] py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-16 sm:py-14"
      >
        <div className="flex flex-col gap-[18px]">
          <span className="h-3 w-16 rounded bg-soft" />
          <span className="h-11 w-3/5 max-w-[360px] rounded-lg bg-soft sm:h-[72px]" />
          <span className="h-4 w-2/5 max-w-[280px] rounded bg-soft" />
        </div>
        <span className="hidden size-[180px] rounded-full bg-soft sm:block" />
      </div>
      <FeedSkeleton />
    </>
  );
}
