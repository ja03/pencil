import type { Metadata } from "next";
import Link from "next/link";
import { ErrorScreen, primaryAction, secondaryAction } from "@/components/error-screen";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Page not found · Pencil" };

/**
 * The 404 page: unknown URLs, unknown slugs and usernames, deleted posts and
 * other people's drafts all land here, so it never says which one it was.
 */
export default function NotFound() {
  return (
    <PageTransition>
      <ErrorScreen
        code="404"
        eyebrow="Page not found"
        title="This page has been erased."
        body="The post may have been deleted, or the link is mistyped. Drafts are only visible to their author."
        actions={
          <>
            <Link href="/" className={primaryAction}>
              Back to the feed
            </Link>
            <Link href="/write" className={secondaryAction}>
              Write something
            </Link>
          </>
        }
      />
    </PageTransition>
  );
}
