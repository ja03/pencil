import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton, PostEditor } from "@/components/post-editor";
import { normalizeTag } from "@/contracts/tags";

export const metadata: Metadata = { title: "New post · Pencil" };

/**
 * A blank editor. The proxy sends visitors who aren't signed in to log in.
 * `?tag=` starts the post with that tag (a tag page's "Write with this tag").
 */
export default function NewPostPage({ searchParams }: PageProps<"/write">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewPost searchParams={searchParams} />
    </Suspense>
  );
}

async function NewPost({ searchParams }: Pick<PageProps<"/write">, "searchParams">) {
  const { tag } = await searchParams;
  const initialTag = typeof tag === "string" ? normalizeTag(tag) : null;
  return <PostEditor initial={null} initialTags={initialTag ? [initialTag] : []} />;
}
