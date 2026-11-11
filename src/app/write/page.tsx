import type { Metadata } from "next";
import { PostEditor } from "@/components/post-editor";

export const metadata: Metadata = { title: "New post · Pencil" };

/** A blank editor. The proxy sends visitors who aren't signed in to log in. */
export default function NewPostPage() {
  return <PostEditor initial={null} />;
}
