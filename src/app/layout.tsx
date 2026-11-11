import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { StoreProvider } from "@/client/store-provider";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/server/auth/service";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

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
      <SiteHeader />
      {children}
    </StoreProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Suspense>
          <Session>{children}</Session>
        </Suspense>
      </body>
    </html>
  );
}
