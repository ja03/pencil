import { expect } from "vitest";
import { POST as publishPost } from "@/app/api/posts/[id]/publish/route";
import { POST as createPost } from "@/app/api/posts/route";
import type { signedIn } from "./auth";
import { call } from "./request";

export type Author = Awaited<ReturnType<typeof signedIn>>;

export type CreatedPost = { id: string; slug: string; title: string };

const content = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** Saves a draft for `author` through the API. */
export async function draftBy(author: Author, title: string, tags: string[] = []) {
  const res = await call(createPost, {
    method: "POST",
    path: "/api/posts",
    body: { title, content: content(`The body of ${title}.`), tags },
    headers: author.headers,
  });
  expect(res.status).toBe(201);
  return res.body.post as CreatedPost;
}

/** Saves and publishes a post for `author` (who must be verified). */
export async function publishedBy(author: Author, title: string, tags: string[] = []) {
  const { id } = await draftBy(author, title, tags);
  const res = await call(publishPost, {
    method: "POST",
    path: `/api/posts/${id}/publish`,
    headers: author.headers,
    params: { id },
  });
  expect(res.status).toBe(200);
  return res.body.post as CreatedPost;
}
