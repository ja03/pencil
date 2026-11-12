import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { PageTransition } from "@/components/page-transition";
import { EditorSkeleton, PostEditor } from "@/components/post-editor";
import { normalizeTag } from "@/contracts/tags";
import { requirePageUser } from "@/server/auth/page-guard";
import { storageImageRules } from "@/server/uploads/service";

export const metadata: Metadata = { title: "New post · Pencil" };

/**
 * A blank editor, for signed-in users only.
 * `?tag=` starts the post with that tag (a tag page's "Write with this tag").
 */
export default function NewPostPage({ searchParams }: PageProps<"/write">) {
  return (
    <PageTransition>
      <Suspense fallback={<EditorSkeleton />}>
        <NewPost searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function NewPost({ searchParams }: Pick<PageProps<"/write">, "searchParams">) {
  const { tag } = await searchParams;
  // A revoked session would only find out on its first save; stop it here.
  await requirePageUser(
    await cookies(),
    typeof tag === "string" ? `/write?tag=${encodeURIComponent(tag)}` : "/write",
  );
  const initialTag = typeof tag === "string" ? normalizeTag(tag) : null;
  return (
    <PostEditor
      initial={null}
      initialTags={initialTag ? [initialTag] : []}
      imageBase={storageImageRules().imageBase!}
    />
  );
}
