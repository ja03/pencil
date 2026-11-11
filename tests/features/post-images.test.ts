import { describe, expect, it } from "vitest";
import { PATCH as patchPost } from "@/app/api/posts/[id]/route";
import { POST as publishPost } from "@/app/api/posts/[id]/publish/route";
import { GET as listPosts, POST as createPost } from "@/app/api/posts/route";
import { POST as upload } from "@/app/api/uploads/route";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { signedIn } from "../helpers/auth";
import { IMAGE_BYTES, imageForm, padded } from "../helpers/images";
import { call } from "../helpers/request";

type Headers = Record<string, string>;

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const image = (src: string) => ({ type: "image", attrs: { src, alt: "A photo", title: null } });
const doc = (...content: unknown[]) => ({ type: "doc", content });

const draft = { title: "A walk in pictures", content: doc(paragraph("Some words.")) };

function create(body: unknown, headers: Headers) {
  return call(createPost, { method: "POST", path: "/api/posts", body, headers });
}

function edit(id: string, body: unknown, headers: Headers) {
  return call(patchPost, { method: "PATCH", path: `/api/posts/${id}`, body, headers, params: { id } });
}

/** Uploads a small PNG as `headers`' user and returns its public URL. */
async function uploaded(headers: Headers): Promise<string> {
  const res = await call(upload, {
    method: "POST",
    path: "/api/uploads",
    body: imageForm(padded(IMAGE_BYTES.png, 128)),
    headers,
  });
  expect(res.status).toBe(201);
  return res.body.upload.url;
}

const EXTERNAL = "https://tracker.example/pixel.gif";

describe("inline images", () => {
  it("saves content with an uploaded image and renders it in the post's HTML", async () => {
    const { headers } = await signedIn();
    const src = await uploaded(headers);

    const res = await create({ ...draft, content: doc(paragraph("Look:"), image(src)) }, headers);

    expect(res.status).toBe(201);
    expect(res.body.post.content.content[1]).toEqual(image(src));
    expect(res.body.post.html).toBe(
      `<p>Look:</p><img src="${src}" alt="A photo" loading="lazy">`,
    );
  });

  it.each([
    ["another site", EXTERNAL],
    ["the same host outside the bucket", `${new URL(env().S3_PUBLIC_URL).origin}/other-bucket/a.png`],
    ["a path climbing out of the bucket", `${env().S3_PUBLIC_URL}/../other-bucket/a.png`],
  ])("rejects an image from %s with 400 and saves nothing", async (_, src) => {
    const { headers } = await signedIn();

    const res = await create({ ...draft, content: doc(paragraph("x"), image(src)) }, headers);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields).toEqual({ content: ["Images must be uploaded to Pencil."] });
    expect(await db().post.count()).toBe(0);
  });

  it("rejects an edit that adds an external image and leaves the post unchanged", async () => {
    const { headers } = await signedIn();
    const { post } = (await create(draft, headers)).body;

    const res = await edit(post.id, { content: doc(paragraph("x"), image(EXTERNAL)) }, headers);

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ content: ["Images must be uploaded to Pencil."] });
    const stored = await db().post.findUniqueOrThrow({ where: { id: post.id } });
    expect(stored.content).toEqual(draft.content);
  });
});

describe("cover images", () => {
  it("saves an uploaded cover and shows it on the post and its feed card", async () => {
    const { headers } = await signedIn({ verified: true });
    const coverUrl = await uploaded(headers);

    const created = await create({ ...draft, coverUrl }, headers);
    expect(created.status).toBe(201);
    expect(created.body.post.coverUrl).toBe(coverUrl);

    const id = created.body.post.id;
    await call(publishPost, { method: "POST", path: `/api/posts/${id}/publish`, headers, params: { id } });
    const feed = await call(listPosts, { path: "/api/posts" });
    expect(feed.body.posts[0]).toMatchObject({ id, coverUrl });
  });

  it("defaults to no cover", async () => {
    const { headers } = await signedIn();

    const res = await create(draft, headers);

    expect(res.body.post.coverUrl).toBeNull();
  });

  it("adds, replaces and removes a cover by editing, and keeps it when left out", async () => {
    const { headers } = await signedIn();
    const { post } = (await create(draft, headers)).body;
    const first = await uploaded(headers);
    const second = await uploaded(headers);

    expect((await edit(post.id, { coverUrl: first }, headers)).body.post.coverUrl).toBe(first);
    expect((await edit(post.id, { coverUrl: second }, headers)).body.post.coverUrl).toBe(second);
    expect((await edit(post.id, { title: "Renamed" }, headers)).body.post.coverUrl).toBe(second);
    expect((await edit(post.id, { coverUrl: null }, headers)).body.post.coverUrl).toBeNull();
  });

  it("marks a published post edited when only its cover changes", async () => {
    const { headers } = await signedIn({ verified: true });
    const { post } = (await create(draft, headers)).body;
    await call(publishPost, { method: "POST", path: `/api/posts/${post.id}/publish`, headers, params: { id: post.id } });

    const res = await edit(post.id, { coverUrl: await uploaded(headers) }, headers);

    expect(res.body.post.editedAt).not.toBeNull();
  });

  it.each([
    ["another site", EXTERNAL, "Cover images must be uploaded to Pencil."],
    ["a data: URL", "data:image/png;base64,AAAA", "Cover images need an http(s) address."],
    ["a javascript: URL", "javascript:alert(1)", "Cover images need an http(s) address."],
  ])("rejects a cover from %s with 400", async (_, coverUrl, message) => {
    const { headers } = await signedIn();
    const { post } = (await create(draft, headers)).body;

    const created = await create({ ...draft, coverUrl }, headers);
    const edited = await edit(post.id, { coverUrl }, headers);

    for (const res of [created, edited]) {
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toEqual({ coverUrl: [message] });
    }
    expect(await db().post.count()).toBe(1);
    expect((await db().post.findUniqueOrThrow({ where: { id: post.id } })).coverUrl).toBeNull();
  });
});
