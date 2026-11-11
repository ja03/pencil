import type { RecommendationsResponse } from "@/contracts/recommendations";
import { PostCard, PostCardSkeleton } from "./post-card";

const eyebrow =
  "label-mono inline-flex items-center gap-2 tracking-[0.1em] text-acc";

function Sparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

/**
 * Five columns on wide screens; a row that scrolls sideways below that. It
 * scrolls instead of widening the page because its section has min-w-0 and
 * it is `relative`, which keeps the cards' absolutely positioned screen-reader
 * text inside it.
 */
const ROW =
  "relative m-0 grid list-none auto-cols-[240px] grid-flow-col gap-4 overflow-x-auto p-0 pb-1 xl:auto-cols-auto xl:grid-flow-row xl:grid-cols-5";

/** Three columns from tablet width up, stacked on phones. */
const TRIO = "m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3";

function rowCopy(result: RecommendationsResponse, signedIn: boolean) {
  if (result.basis === "liked") {
    return {
      eyebrow: "Recommended for you",
      title: "Picked from what you like",
      note: "Chosen from the posts you liked. Never your own posts, and nothing you've already liked.",
    };
  }
  return {
    eyebrow: "Popular this month",
    title: "Most liked in the last 30 days",
    note: signedIn
      ? "Like posts you enjoy, and this row starts learning your taste."
      : "Sign in and like a few posts, and this row starts learning your taste.",
  };
}

/**
 * The feed's "Recommended for you" row, or the popular posts of the month
 * when there's nothing to go on yet. Renders nothing when there are no posts.
 */
export function RecommendedRow({
  result,
  signedIn,
}: {
  result: RecommendationsResponse;
  signedIn: boolean;
}) {
  if (result.posts.length === 0) return null;
  const copy = rowCopy(result, signedIn);
  return (
    <section aria-labelledby="rec-title" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2.5">
          <span className={eyebrow}>
            <Sparkle />
            {copy.eyebrow}
          </span>
          <h2 id="rec-title" className="m-0 font-serif text-[30px] font-normal tracking-[-0.01em] sm:text-[40px]">
            {copy.title}
          </h2>
        </div>
        <p className="m-0 max-w-[360px] text-sm leading-[1.55] text-mut">{copy.note}</p>
      </div>
      <ul className={ROW}>
        {result.posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} variant="compact" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Placeholder for the feed's recommendation row while it loads. */
export function RecommendedRowSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading recommendations" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <span className="h-3 w-40 rounded-md bg-soft" />
        <span className="h-9 w-72 max-w-full rounded-lg bg-soft" />
      </div>
      <div className={ROW}>
        {[0, 1, 2, 3, 4].map((i) => (
          <PostCardSkeleton key={i} variant="compact" />
        ))}
      </div>
    </div>
  );
}

const MORE_FRAME =
  "flex w-full max-w-[1080px] flex-col gap-[18px] border-t border-line pt-8";

/**
 * "More like this" under a post: related posts, or the month's popular ones
 * when nothing is related. Renders nothing when there are no other posts.
 */
export function MoreLikeThis({ result }: { result: RecommendationsResponse }) {
  if (result.posts.length === 0) return null;
  return (
    <section aria-labelledby="more-title" className={MORE_FRAME}>
      <span className={eyebrow}>
        <Sparkle />
        {result.basis === "similar" ? "Related reading" : "Popular this month"}
      </span>
      <h2 id="more-title" className="m-0 font-serif text-[26px] font-normal sm:text-[34px]">
        More like this
      </h2>
      <ul className={TRIO}>
        {result.posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} variant="compact" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Placeholder for "More like this" while it loads. */
export function MoreLikeThisSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading related posts" className={MORE_FRAME}>
      <span className="h-3 w-32 rounded-md bg-soft" />
      <span className="h-8 w-56 rounded-lg bg-soft" />
      <div className={TRIO}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={i > 0 ? "hidden md:block" : undefined}>
            <PostCardSkeleton variant="compact" />
          </div>
        ))}
      </div>
    </div>
  );
}
