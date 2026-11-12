import { cookies } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FeedList, FeedSkeleton } from "@/components/feed-list";
import { RecommendedRow, RecommendedRowSkeleton } from "@/components/recommended-posts";
import { getCurrentUser } from "@/server/auth/service";
import { listPublished } from "@/server/posts/service";
import { recommendFor } from "@/server/recommendations/service";

const mono = "label-mono tracking-[0.1em]";

/**
 * The public feed: "Recommended for you" (or the month's popular posts), then
 * everything published, newest first. No account needed.
 */
export default function FeedPage() {
  return (
    <main className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-11 px-4 pt-2 pb-14 sm:gap-[72px] sm:px-10 sm:pt-3 sm:pb-24">
      <Hero />
      <Suspense fallback={<RecommendedRowSkeleton />}>
        <Recommended />
      </Suspense>
      <section id="latest" aria-labelledby="latest-title" className="flex scroll-mt-6 flex-col gap-5">
        <div className="flex items-center justify-between gap-3 border-t border-line pt-7">
          <h2 id="latest-title" className="m-0 font-serif text-[30px] font-normal tracking-[-0.01em] sm:text-[40px]">
            Latest
          </h2>
          <span className={`${mono} text-mut`}>Newest first</span>
        </div>
        <Suspense fallback={<FeedSkeleton />}>
          <LatestPosts />
        </Suspense>
      </section>
    </main>
  );
}

async function LatestPosts() {
  // Always fresh: read at request time, never prerendered.
  await connection();
  const first = await listPublished(await getCurrentUser(await cookies()), null);
  if (first.posts.length === 0) {
    return (
      <EmptyState
        title="The page is still blank"
        body="No one has published yet. Be the first name on the masthead."
        action={{ href: "/write", label: "Write the first post" }}
      />
    );
  }
  return <FeedList initial={first} />;
}

async function Recommended() {
  await connection();
  const viewer = await getCurrentUser(await cookies());
  return <RecommendedRow result={await recommendFor(viewer)} signedIn={viewer !== null} />;
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex flex-col items-center gap-5 overflow-hidden rounded-[20px] px-[22px] pt-11 text-center text-[#FBF4E8] sm:rounded-[28px] sm:px-12 sm:pt-[84px]"
      style={{
        background:
          "repeating-linear-gradient(118deg, rgba(255,240,222,0.05) 0 1px, transparent 1px 7px), radial-gradient(circle at 78% 18%, rgba(240,178,128,0.55), transparent 45%), radial-gradient(circle at 12% 90%, rgba(80,30,14,0.55), transparent 50%), linear-gradient(150deg, #9A3E1F, #BC5A2F)",
      }}
    >
      <span className={`${mono} inline-flex items-center gap-2 rounded-full bg-[rgba(28,16,10,0.35)] px-3.5 py-[7px]`}>
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 20 12 12 22 4 12z" fill="#F3C9A2" />
        </svg>
        A journal for many hands
      </span>
      <h1
        id="hero-title"
        className="m-0 max-w-[760px] font-serif text-[44px] leading-[1.02] font-normal tracking-[-0.02em] sm:text-[76px]"
      >
        Ideas worth slowing down for.
      </h1>
      <p className="m-0 max-w-[520px] text-[15px] leading-[1.6] text-[rgba(251,244,232,0.88)] sm:text-[17px]">
        Read essays, notes and long thoughts from writers you&apos;ll come back to. Sign in to
        write your own.
      </p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/write"
          className={`${mono} inline-flex h-[46px] items-center gap-2.5 rounded-full bg-[#1C1510] px-5 text-[#FBF4E8] no-underline`}
        >
          Start writing
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
        <a
          href="#latest"
          className={`${mono} inline-flex h-[46px] items-center rounded-full border border-[rgba(251,244,232,0.45)] px-5 text-[#FBF4E8] no-underline`}
        >
          Read the latest
        </a>
      </div>
      <svg
        aria-hidden="true"
        viewBox="0 0 640 150"
        className="mt-[18px] -mb-5 w-full max-w-[640px]"
        fill="none"
        stroke="#F6D7B8"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <path d="M40 140 C140 118 220 118 320 132 C420 118 500 118 600 140" />
        <path d="M320 132 V40" />
        <path d="M60 128 C150 104 230 104 320 118 M60 112 C150 90 230 90 320 104 M80 96 C160 76 240 78 320 90" />
        <path d="M580 128 C490 104 410 104 320 118 M580 112 C490 90 410 90 320 104 M560 96 C480 76 400 78 320 90" />
        <path d="M455 20 L540 104 L528 112 L444 28 Z" />
        <path d="M540 104 L548 122 L528 112" />
        <path d="M455 20 L462 13 L548 97 L540 104" />
        <circle cx="120" cy="40" r="22" strokeDasharray="2 5" />
      </svg>
    </section>
  );
}
