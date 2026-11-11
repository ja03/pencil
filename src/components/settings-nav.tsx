"use client";

import Link from "next/link";
import { useLogOut } from "@/client/use-log-out";
import { SETTINGS_TABS, settingsPath, type SettingsTab } from "./settings-tabs";

const item =
  "flex min-h-11 flex-none items-center rounded-xl px-3.5 text-sm font-medium no-underline";

/**
 * The settings sections: a column beside the content on wide screens, a
 * scrolling row above it on phones. Desktop also gets Log out here; phones
 * get it at the end of the Account section.
 */
export function SettingsNav({ current }: { current: SettingsTab }) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-none gap-1 overflow-x-auto [scrollbar-width:none] md:w-[220px] md:flex-col"
    >
      {SETTINGS_TABS.map(({ tab, label }) => (
        <Link
          key={tab}
          href={settingsPath(tab)}
          aria-current={tab === current ? "page" : undefined}
          className={`${item} ${tab === current ? "bg-soft text-ink" : "text-mut hover:bg-soft"}`}
        >
          {label}
        </Link>
      ))}
      <span aria-hidden="true" className="mx-3.5 my-2.5 hidden h-px bg-line md:block" />
      <LogOutButton className={`${item} hidden cursor-pointer text-left text-mut hover:bg-soft disabled:opacity-60 md:flex`} />
    </nav>
  );
}

export function LogOutButton({ className }: { className: string }) {
  const { logOut, loggingOut } = useLogOut();
  return (
    <button type="button" onClick={logOut} disabled={loggingOut} className={className}>
      Log out
    </button>
  );
}
