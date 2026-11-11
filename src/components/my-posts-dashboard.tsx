"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiErrorOf } from "@/client/api";
import { shortDate } from "@/client/format";
import { useDeletePostMutation } from "@/client/posts-api";
import type { MyPost, PostStatus } from "@/contracts/posts";
import { EmptyState } from "./empty-state";
import { PostCover } from "./post-cover";
import { useToast } from "./toaster";

type Filter = "all" | PostStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
];

const EMPTY_FILTER: Record<PostStatus, string> = {
  draft: "No drafts. Everything you've written is published.",
  published: "Nothing published yet. Publish a draft and it shows up here.",
};

/** Title, status, updated, actions on wide screens; stacked on phones. */
const ROW_GRID = "md:grid-cols-[minmax(0,1fr)_120px_120px_220px]";

const pill =
  "inline-flex h-10 items-center rounded-full border border-line px-3.5 text-[13px] font-medium no-underline hover:bg-soft";

/**
 * The My posts dashboard: every draft and published post, filterable, with
 * edit, view and delete. Deleting asks first, then reports with a toast.
 */
export function MyPostsDashboard({ initial }: { initial: MyPost[] }) {
  const [posts, setPosts] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState<MyPost | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  if (posts.length === 0) {
    return (
      <EmptyState
        level={2}
        title="Nothing written yet"
        body="Drafts and published posts you write will show up here, ready to edit or delete."
        action={{ href: "/write", label: "Write your first post" }}
      />
    );
  }

  const count = (f: Filter) => (f === "all" ? posts.length : posts.filter((p) => p.status === f).length);
  const shown = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  function removed(id: string) {
    setPosts((current) => current.filter((p) => p.id !== id));
    // The row that held focus is gone; keep keyboard users in the list.
    listRef.current?.focus();
  }

  return (
    <>
      <div
        role="group"
        aria-label="Show posts"
        className="flex gap-1 self-start rounded-full border border-line bg-surf p-1"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className="label-mono h-[38px] cursor-pointer rounded-full border-none bg-transparent px-4 text-mut aria-pressed:bg-soft aria-pressed:text-ink"
          >
            {f.label} · {count(f.value)}
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        tabIndex={-1}
        aria-label="Your posts"
        className="overflow-hidden rounded-[20px] border border-line bg-surf outline-none"
      >
        <div
          aria-hidden="true"
          className={`label-mono hidden gap-4 border-b border-line px-6 py-3.5 text-[10px] tracking-[0.1em] text-mut md:grid ${ROW_GRID}`}
        >
          <span>Title</span>
          <span>Status</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>
        {shown.length === 0 ? (
          <p className="m-0 px-6 py-8 text-sm text-mut">{EMPTY_FILTER[filter as PostStatus]}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {shown.map((post) => (
              <PostRow key={post.id} post={post} onDelete={() => setConfirming(post)} />
            ))}
          </ul>
        )}
      </div>

      <DeleteDialog post={confirming} onClose={() => setConfirming(null)} onDeleted={removed} />
    </>
  );
}

function PostRow({ post, onDelete }: { post: MyPost; onDelete: () => void }) {
  const published = post.status === "published";
  const href = published ? `/posts/${post.slug}` : `/write/${post.id}`;
  const updated = shortDate(post.updatedAt);
  return (
    <li
      className={`grid grid-cols-1 items-center gap-3 border-b border-line p-[18px] last:border-b-0 md:gap-4 md:px-6 md:py-4 ${ROW_GRID}`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span aria-hidden="true" className="relative h-[42px] w-14 flex-none overflow-hidden rounded-lg">
          <PostCover post={post} glyphClassName="text-[40px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <Link href={href} className="font-serif text-[19px] leading-[1.25] break-words text-ink no-underline hover:underline">
            {post.title}
          </Link>
          <span className="truncate text-xs text-mut">
            <span className="md:hidden">Updated {updated} · </span>
            {published ? `/posts/${post.slug}` : "Only visible to you"}
          </span>
        </div>
      </div>
      <span
        className={`label-mono inline-flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-[5px] text-[10px] ${
          published ? "bg-pub-bg text-pub-ink" : "bg-draft-bg text-draft-ink"
        }`}
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        {published ? "Published" : "Draft"}
      </span>
      <span className="hidden text-[13px] text-mut md:block">
        <time dateTime={post.updatedAt}>{updated}</time>
      </span>
      <div className="flex flex-wrap gap-1.5 md:justify-end">
        <Link href={`/write/${post.id}`} className={`${pill} text-ink`}>
          Edit<span className="sr-only"> “{post.title}”</span>
        </Link>
        {published && (
          <Link href={`/posts/${post.slug}`} className={`${pill} text-ink`}>
            View<span className="sr-only"> “{post.title}”</span>
          </Link>
        )}
        <button
          type="button"
          onClick={onDelete}
          className={`${pill} cursor-pointer bg-transparent text-err-ink`}
        >
          Delete<span className="sr-only"> “{post.title}”</span>
        </button>
      </div>
    </li>
  );
}

/** Asks before deleting, since there's no way to restore a deleted post. */
function DeleteDialog({
  post,
  onClose,
  onDeleted,
}: {
  post: MyPost | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [deletePost, { isLoading }] = useDeletePostMutation();
  const toast = useToast();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (post && !el.open) el.showModal();
    if (!post && el.open) el.close();
  }, [post]);

  async function confirm() {
    if (!post) return;
    try {
      await deletePost(post.id).unwrap();
      toast.success("Post deleted.");
      onDeleted(post.id);
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.code === "NOT_FOUND") {
        // Already gone, e.g. deleted in another tab.
        toast.success("That post was already deleted.");
        onDeleted(post.id);
      } else if (apiError?.code === "UNAUTHENTICATED") {
        toast.error("Your session has expired. Log in again, then delete the post.");
      } else {
        toast.error(apiError?.message ?? "Couldn't delete the post. Check your connection.");
      }
    }
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-title"
      aria-describedby="delete-body"
      onClose={onClose}
      className="m-auto box-border w-[calc(100%-32px)] max-w-[460px] rounded-[22px] border border-line bg-surf p-7 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop:bg-[rgba(20,12,8,0.55)]"
    >
      <div className="flex flex-col gap-4">
        <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-err-bg text-err-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </span>
        <h2 id="delete-title" className="m-0 font-serif text-[28px] font-normal">
          Delete this post?
        </h2>
        <p id="delete-body" className="m-0 text-[15px] leading-[1.6] break-words text-mut">
          {post?.status === "published"
            ? `“${post.title}” will disappear from the feed, your profile and its tags, and its link will stop working. There's no way to restore it.`
            : `“${post?.title ?? ""}” will be gone for good. There's no way to restore it.`}
        </p>
        <div className="mt-1.5 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-11 cursor-pointer rounded-full border border-line bg-transparent px-5 text-sm font-medium text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={isLoading}
            className="h-11 cursor-pointer rounded-full border-none bg-danger-btn px-5 text-sm font-semibold text-[#FFF7F2] disabled:opacity-60"
          >
            {isLoading ? "Deleting…" : "Delete post"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Row placeholders while the dashboard loads. */
export function MyPostsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your posts" className="flex flex-col gap-7">
      <span className="h-[48px] w-[300px] max-w-full rounded-full bg-soft" />
      <div className="overflow-hidden rounded-[20px] border border-line bg-surf">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3.5 border-b border-line p-[18px] last:border-b-0 md:px-6">
            <span className="h-[42px] w-14 flex-none rounded-lg bg-soft" />
            <span className="flex flex-1 flex-col gap-2">
              <span className="h-[18px] w-3/5 rounded-md bg-soft" />
              <span className="h-3 w-2/5 rounded-md bg-soft" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
