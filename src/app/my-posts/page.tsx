import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { MyPostsDashboard, MyPostsSkeleton } from "@/components/my-posts-dashboard";
import { requirePageUser } from "@/server/auth/page-guard";
import { listOwnPosts } from "@/server/posts/service";

export const metadata: Metadata = { title: "My posts · Pencil" };

/**
 * The signed-in author's drafts and published posts, with edit and delete.
 * The proxy sends visitors who aren't signed in to log in.
 */
export default function MyPostsPage() {
  return (
    <main className="mx-auto box-border flex w-full max-w-[1120px] flex-col gap-7 px-4 pt-5 pb-16 sm:px-10 sm:pt-10 sm:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="label-mono tracking-[0.1em] text-acc">Private · only you see this</span>
          <h1 className="m-0 font-serif text-[40px] font-normal tracking-[-0.02em] sm:text-[56px]">
            My posts
          </h1>
        </div>
        <Link
          href="/write"
          className="label-mono inline-flex h-[46px] items-center gap-2 rounded-full bg-btn px-5 tracking-[0.1em] text-on-btn no-underline"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New post
        </Link>
      </div>
      <Suspense fallback={<MyPostsSkeleton />}>
        <MyPostsList />
      </Suspense>
    </main>
  );
}

async function MyPostsList() {
  const user = await requirePageUser(await cookies(), "/my-posts");
  const { posts } = await listOwnPosts(user);
  return <MyPostsDashboard initial={posts} />;
}
