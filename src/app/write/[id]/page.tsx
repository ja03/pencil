import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { EditorSkeleton, PostEditor } from "@/components/post-editor";
import { requirePageUser } from "@/server/auth/page-guard";
import { findOwnPost } from "@/server/posts/service";
import { storageImageRules } from "@/server/uploads/service";

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
  const user = await requirePageUser(await cookies(), `/write/${id}`);
  const postId = z.uuid().safeParse(id);
  const post = postId.success ? await findOwnPost(user, postId.data) : null;
  if (!post) notFound();
  // Keyed by id so moving between two posts starts a fresh editor.
  return <PostEditor key={post.id} initial={post} imageBase={storageImageRules().imageBase!} />;
}
