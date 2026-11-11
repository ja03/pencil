"use client";

import { useEffect, useRef, useState } from "react";
import { useGetFeedInfiniteQuery } from "@/client/posts-api";
import type { FeedResponse } from "@/contracts/posts";
import { PostCard, PostCardSkeleton } from "./post-card";

export const FEED_GRID = "grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3";

/**
 * The feed's cards. The first page arrives rendered from the server; later
 * pages load through the API as the reader nears the end of the list.
 */
export function FeedList({ initial }: { initial: FeedResponse }) {
  // Nothing is fetched until the reader scrolls near the end.
  const [started, setStarted] = useState(false);
  const feed = useGetFeedInfiniteQuery(initial.nextCursor ?? "", {
    skip: !started || !initial.nextCursor,
    initialPageParam: initial.nextCursor ?? "",
  });

  const pages = [initial, ...(started ? (feed.data?.pages ?? []) : [])];
  const seen = new Set<string>();
  const posts = pages
    .flatMap((page) => page.posts)
    .filter((post) => !seen.has(post.id) && seen.add(post.id));

  const failed = feed.isError;
  const loading = started && feed.isFetching;
  const hasMore = started ? feed.hasNextPage || (!feed.data && !failed) : !!initial.nextCursor;

  // Ask for the next page when the end of the list comes within ~1.5 screens.
  // Re-observing after each load re-checks a sentinel that is still in view.
  const sentinel = useRef<HTMLDivElement>(null);
  // The hook's result is a new object every render; hold the latest fetcher
  // in a ref so the observer isn't torn down and re-fired on every render.
  const fetchNextPage = useRef(feed.fetchNextPage);
  useEffect(() => {
    fetchNextPage.current = feed.fetchNextPage;
  });
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || loading || failed) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (started) void fetchNextPage.current();
        else setStarted(true);
      },
      { rootMargin: "0px 0px 150% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, failed, started]);

  function retry() {
    if (feed.data) void feed.fetchNextPage();
    else void feed.refetch();
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className={`${FEED_GRID} m-0 list-none p-0`}>
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
        {loading &&
          [0, 1, 2].map((i) => (
            <li key={`skeleton-${i}`} className={i > 0 ? "hidden md:block" : undefined}>
              <PostCardSkeleton />
            </li>
          ))}
      </ul>

      <div ref={sentinel} className="flex min-h-11 flex-col items-center justify-center gap-3">
        <p role="status" className="label-mono m-0 text-center text-mut">
          {failed
            ? "Couldn't load more posts."
            : loading
              ? "Loading more posts…"
              : hasMore
                ? ""
                : "You've reached the end"}
        </p>
        {failed && (
          <button
            type="button"
            onClick={retry}
            className="label-mono h-11 cursor-pointer rounded-full border border-line bg-transparent px-[22px] text-ink"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
