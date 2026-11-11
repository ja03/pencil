import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { PostEditor } from "@/components/post-editor";
import { getCurrentUser } from "@/server/auth/service";
import { findOwnPost } from "@/server/posts/service";

export const metadata: Metadata = { title: "Edit post · Pencil" };

/** Edits one of your own posts. Anyone else's post, or a missing one, is a 404. */
export default function EditPostPage({ params }: PageProps<"/write/[id]">) {
  // The session and post load at request time, so they stream in behind a
  // boundary while the shell shows straight away.
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditPost params={params} />
    </Suspense>
  );
}

async function EditPost({ params }: Pick<PageProps<"/write/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser(await cookies());
  // The proxy only checks the token; a revoked session lands here.
  if (!user) redirect(`/login?next=${encodeURIComponent(`/write/${id}`)}`);
  const postId = z.uuid().safeParse(id);
  const post = postId.success ? await findOwnPost(user, postId.data) : null;
  if (!post) notFound();
  // Keyed by id so moving between two posts starts a fresh editor.
  return <PostEditor key={post.id} initial={post} />;
}

function EditorSkeleton() {
  const bar = "rounded-lg bg-soft";
  return (
    <div aria-busy="true" aria-label="Loading your post" className="flex min-h-dvh flex-col bg-bg">
      <div className="h-[73px] border-b border-line bg-surf" />
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4 pt-6 sm:px-8 sm:pt-12">
        <span className={`${bar} h-12 w-4/5`} />
        <span className={`${bar} h-20 w-full`} />
        <span className={`${bar} h-80 w-full rounded-[18px]`} />
      </div>
    </div>
  );
}
