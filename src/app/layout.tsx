import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { StoreProvider } from "@/client/store-provider";
import { SiteHeader } from "@/components/site-header";
import { ThemeScript } from "@/components/theme-script";
import { ToastProvider } from "@/components/toaster";
import { getCurrentUser } from "@/server/auth/service";
import { fontClasses } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pencil",
  description: "A multi-author blog for rich posts, with recommendations for what to read next.",
};

/**
 * Reads the session once per request and seeds this request's store with the
 * user. It reads cookies, so it renders at request time behind the Suspense
 * boundary below.
 */
async function Session({ children }: { children: ReactNode }) {
  const user = await getCurrentUser(await cookies());
  return (
    <StoreProvider user={user}>
      <ToastProvider>
        <SiteHeader />
        {children}
      </ToastProvider>
    </StoreProvider>
  );
}

/**
 * The theme cookie is read by an inline script, not `cookies()`: reading it
 * here would make every page block on the request instead of streaming from
 * the static shell. See docs/adr/0001-theme-applied-by-inline-script.md.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontClasses} h-full antialiased`}
      // The head script adds data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <Suspense>
          <Session>{children}</Session>
        </Suspense>
      </body>
    </html>
  );
}
