import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { GET as previewImage } from "@/app/og/route";
import { PATCH as updatePost, DELETE as deletePost } from "@/app/api/posts/[id]/route";
import { generateMetadata as postMetadata } from "@/app/posts/[slug]/page";
import { generateMetadata as tagMetadata } from "@/app/tags/[tag]/page";
import { generateMetadata as profileMetadata } from "@/app/u/[username]/page";
import { signedIn } from "../helpers/auth";
import { draftBy, publishedBy, type Author } from "../helpers/posts";
import { call } from "../helpers/request";
import { testEnv } from "../setup/env";

const APP = testEnv.APP_URL;
const DEFAULT_IMAGE = `${APP}/og`;

// generateMetadata takes the page's props; only `params` matters here.
type MetadataProps = Parameters<typeof postMetadata>[0];
const props = <P,>(params: P) =>
  ({ params: Promise.resolve(params), searchParams: Promise.resolve({}) }) as unknown as MetadataProps;

/** The Open Graph fields a link preview reads, as plain values. */
function preview(meta: Metadata) {
  const og = meta.openGraph as Record<string, unknown> | undefined;
  const images = (og?.images ?? []) as { url: string | URL }[];
  return {
    title: og?.title,
    description: og?.description,
    url: og?.url?.toString(),
    image: images[0]?.url.toString(),
    twitterCard: (meta.twitter as { card?: string } | undefined)?.card,
  };
}

async function setCover(author: Author, id: string, coverUrl: string | null) {
  const res = await call(updatePost, {
    method: "PATCH",
    path: `/api/posts/${id}`,
    headers: author.headers,
    params: { id },
    body: { coverUrl },
  });
  expect(res.status).toBe(200);
}

describe("post page link preview", () => {
  it("uses the post's title, summary and cover", async () => {
    const lina = await signedIn({ username: "lina_k", verified: true });
    const post = await publishedBy(lina, "Slow mornings");
    const cover = `${testEnv.S3_PUBLIC_URL}/covers/slow.jpg`;
    await setCover(lina, post.id, cover);

    const meta = await postMetadata(props({ slug: post.slug }));

    expect(meta.title).toBe("Slow mornings · Pencil");
    expect(preview(meta)).toEqual({
      title: "Slow mornings",
      description: "The body of Slow mornings.",
      url: `${APP}/posts/${post.slug}`,
      image: cover,
      twitterCard: "summary_large_image",
    });
    expect((meta.openGraph as { type?: string }).type).toBe("article");
  });

  it("falls back to Pencil's preview image when the post has no cover", async () => {
    const lina = await signedIn({ verified: true });
    const post = await publishedBy(lina, "No cover here");

    const meta = await postMetadata(props({ slug: post.slug }));

    expect(preview(meta).image).toBe(DEFAULT_IMAGE);
  });

  it("reveals nothing about a draft", async () => {
    const lina = await signedIn({ verified: true });
    const draft = await draftBy(lina, "Secret plans");

    const meta = await postMetadata(props({ slug: draft.slug }));

    expect(JSON.stringify(meta)).not.toContain("Secret plans");
    expect(meta.openGraph).toBeUndefined();
  });

  it("reveals nothing about a deleted post", async () => {
    const lina = await signedIn({ verified: true });
    const post = await publishedBy(lina, "Gone soon");
    const res = await call(deletePost, {
      method: "DELETE",
      path: `/api/posts/${post.id}`,
      headers: lina.headers,
      params: { id: post.id },
    });
    expect(res.status).toBe(204);

    const meta = await postMetadata(props({ slug: post.slug }));

    expect(JSON.stringify(meta)).not.toContain("Gone soon");
    expect(meta.openGraph).toBeUndefined();
  });

  it("gives an unknown slug no preview", async () => {
    const meta = await postMetadata(props({ slug: "no-such-post" }));

    expect(meta.openGraph).toBeUndefined();
  });
});

describe("profile page link preview", () => {
  it("names the author and links to their profile", async () => {
    const lina = await signedIn({ username: "lina_k", verified: true });
    await publishedBy(lina, "One");

    const meta = await profileMetadata(props({ username: "lina_k" }) as never);

    expect(meta.title).toBe("@lina_k · Pencil");
    expect(preview(meta)).toEqual({
      title: "@lina_k on Pencil",
      description: "1 post by @lina_k on Pencil, newest first.",
      url: `${APP}/u/lina_k`,
      image: DEFAULT_IMAGE,
      twitterCard: "summary_large_image",
    });
    expect((meta.openGraph as { type?: string }).type).toBe("profile");
  });

  it("gives an unknown author no preview", async () => {
    const meta = await profileMetadata(props({ username: "nobody_here" }) as never);

    expect(meta.openGraph).toBeUndefined();
  });
});

describe("tag page link preview", () => {
  it("names the tag and counts its posts", async () => {
    const lina = await signedIn({ verified: true });
    await publishedBy(lina, "One", ["react"]);
    await publishedBy(lina, "Two", ["react"]);

    const meta = await tagMetadata(props({ tag: "React" }) as never);

    expect(meta.title).toBe("#react · Pencil");
    expect(preview(meta)).toEqual({
      title: "#react on Pencil",
      description: "2 posts tagged react on Pencil, newest first.",
      url: `${APP}/tags/react`,
      image: DEFAULT_IMAGE,
      twitterCard: "summary_large_image",
    });
  });

  it("still previews a tag nobody has used yet", async () => {
    const meta = await tagMetadata(props({ tag: "woodworking" }) as never);

    expect(preview(meta)).toMatchObject({
      title: "#woodworking on Pencil",
      description: "Posts tagged woodworking on Pencil, newest first.",
      image: DEFAULT_IMAGE,
    });
  });
});

describe("GET /og", () => {
  it("serves Pencil's default preview image as a PNG", async () => {
    const res = await previewImage();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    // PNG signature.
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});
