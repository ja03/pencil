"use client";

import { useEffect } from "react";
import {
  ErrorScreen,
  errorReference,
  primaryAction,
  secondaryAction,
  serverErrorCopy,
} from "@/components/error-screen";
import { ThemeScript } from "@/components/theme-script";
import { fontClasses } from "./fonts";
import "./globals.css";

/**
 * The 500 page when the root layout itself fails (say, the database is down
 * while reading the session). It replaces the layout, so it brings its own
 * document, styles, fonts and theme, and plain links that reload the page.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={`${fontClasses} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <title>Something went wrong · Pencil</title>
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <ErrorScreen
          {...serverErrorCopy(errorReference(error))}
          actions={
            <>
              <button type="button" onClick={() => retry()} className={primaryAction}>
                Try again
              </button>
              {/* A full load, since the layout that failed must render again. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className={secondaryAction}>
                Back to the feed
              </a>
            </>
          }
        />
      </body>
    </html>
  );
}
