"use client";

import Link from "next/link";
import { selectCurrentUser } from "@/client/auth-slice";
import { useAppSelector } from "@/client/store";

/**
 * On your own profile, a way to the My posts dashboard. The profile page
 * itself is the same for every reader; only this link depends on who's looking.
 */
export function OwnProfileLink({ username }: { username: string }) {
  const user = useAppSelector(selectCurrentUser);
  if (user?.username !== username) return null;
  return (
    <Link
      href="/my-posts"
      className="label-mono flex h-11 items-center self-start rounded-full border border-line px-[18px] tracking-[0.1em] text-ink no-underline hover:bg-soft"
    >
      Manage my posts
    </Link>
  );
}
