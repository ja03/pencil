"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ErrorScreen,
  errorReference,
  primaryAction,
  secondaryAction,
  serverErrorCopy,
} from "@/components/error-screen";

/**
 * The 500 page for anything that fails while rendering a page. The site
 * header stays, since it belongs to the root layout above this boundary.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <title>Something went wrong · Pencil</title>
      <ErrorScreen
        {...serverErrorCopy(errorReference(error))}
        actions={
          <>
            <button type="button" onClick={() => retry()} className={primaryAction}>
              Try again
            </button>
            <Link href="/" className={secondaryAction}>
              Back to the feed
            </Link>
          </>
        }
      />
    </>
  );
}
