import type { Metadata } from "next";
import { appUrl } from "./env";

/** Pencil's own preview card, served by `src/app/og/route.tsx`. */
export const PREVIEW_IMAGE = { path: "/og", width: 1200, height: 630 } as const;

type LinkPreview = {
  /** The page's own title; the tab adds " · Pencil". */
  title: string;
  /** What the shared card says under the title. */
  previewTitle?: string;
  description: string;
  /** The page's path, e.g. `/posts/slow-mornings`. */
  path: string;
  /** An absolute image address; Pencil's preview card when there's none. */
  image?: string | null;
  imageAlt?: string;
  type?: "website" | "article" | "profile";
  /** Extra Open Graph fields for the type, such as an article's publish time. */
  extra?: Record<string, unknown>;
};

/**
 * The tab title plus the Open Graph and Twitter tags that make a shared link
 * show a preview card. Addresses are absolute and built from `APP_URL`, never
 * the request's Host header.
 */
export function linkPreview({
  title,
  previewTitle = title,
  description,
  path,
  image,
  imageAlt = previewTitle,
  type = "website",
  extra = {},
}: LinkPreview): Metadata {
  const base = appUrl();
  const images = [
    image
      ? { url: image, alt: imageAlt }
      : {
          url: `${base}${PREVIEW_IMAGE.path}`,
          width: PREVIEW_IMAGE.width,
          height: PREVIEW_IMAGE.height,
          alt: "Pencil",
        },
  ];
  return {
    title: `${title} · Pencil`,
    description,
    alternates: { canonical: `${base}${path}` },
    openGraph: {
      ...extra,
      type,
      siteName: "Pencil",
      title: previewTitle,
      description,
      url: `${base}${path}`,
      images,
    } as Metadata["openGraph"],
    twitter: { card: "summary_large_image", title: previewTitle, description, images },
  };
}
