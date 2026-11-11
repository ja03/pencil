"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLogoutMutation } from "@/client/api";
import { selectCurrentUser, signedOut } from "@/client/auth-slice";
import { useAppDispatch, useAppSelector } from "@/client/store";
import { Logo } from "./logo";

const pill =
  "label-mono flex h-11 items-center rounded-full px-[18px] no-underline transition-opacity hover:opacity-85";

export function SiteHeader() {
  const user = useAppSelector(selectCurrentUser);
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();

  // The auth screens have their own full-page layout.
  if (pathname === "/login" || pathname === "/register") return null;

  async function onLogout() {
    try {
      await logout().unwrap();
    } finally {
      dispatch(signedOut());
      router.push("/");
      router.refresh();
    }
  }

  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-3.5 sm:px-10 sm:py-5">
      <Link href="/" className="text-ink no-underline" aria-label="Pencil home">
        <Logo />
      </Link>

      <div className="flex items-center gap-2.5">
        {user ? (
          <>
            <span
              title={`Signed in as @${user.username}`}
              className="flex size-11 items-center justify-center rounded-full bg-acc font-serif text-lg text-bg"
            >
              <span aria-hidden="true">{user.username[0]?.toUpperCase()}</span>
              <span className="sr-only">Signed in as @{user.username}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className={`${pill} cursor-pointer border border-line bg-surf text-ink disabled:opacity-60`}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="label-mono hidden h-11 items-center px-3 text-ink no-underline sm:flex">
              Log in
            </Link>
            <Link href="/register" className={`${pill} bg-btn text-on-btn`}>
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
