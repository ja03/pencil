"use client";

import { useEffect, useState } from "react";

/**
 * Warns before the user leaves a page with unsaved work.
 *
 * - Reloading, closing the tab or going to another site: the browser's own
 *   "Leave site?" prompt (browsers don't allow a custom one there).
 * - Following a link inside Pencil: the link is held back and its address
 *   returned as `pendingHref`, so the page can show its own dialog and then
 *   either `stay()` or go on.
 */
export function useLeaveGuard(dirty: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      // Modifier clicks open a new tab, which doesn't lose anything here.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return; // beforeunload covers it
      if (url.pathname === window.location.pathname && url.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase, so Next's <Link> never sees the click.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return { pendingHref, stay: () => setPendingHref(null) };
}
