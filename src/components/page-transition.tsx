import { ViewTransition, type ReactNode } from "react";

/**
 * Crossfades a page in and out when the reader navigates. Next.js runs every
 * navigation as a transition, so React animates this boundary leaving and
 * the next page's arriving, with the `page-exit` and `page-enter` classes in
 * globals.css. Each page wraps itself: layouts persist across navigations,
 * so a boundary there would never enter or exit. Nothing else (a Suspense
 * reveal, a refresh) animates it.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
