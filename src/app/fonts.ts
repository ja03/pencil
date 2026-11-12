import { IBM_Plex_Mono, Inter, Newsreader } from "next/font/google";

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

/**
 * Classes for <html> that load Pencil's three typefaces as CSS variables.
 * Shared by the root layout and the global error page, which replaces it.
 */
export const fontClasses = `${inter.variable} ${newsreader.variable} ${plexMono.variable}`;
