"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLogoutMutation } from "@/client/api";
import { selectCurrentUser, signedOut } from "@/client/auth-slice";
import { useAppDispatch, useAppSelector } from "@/client/store";
import { profilePath } from "@/contracts/users";
import { Logo } from "./logo";

const pill =
  "label-mono flex h-11 items-center rounded-full px-[18px] no-underline transition-opacity hover:opacity-85";

const navLink =
  "label-mono rounded-full px-3.5 py-2 text-ink no-underline hover:bg-soft aria-[current=page]:bg-soft";

export function SiteHeader() {
  const user = useAppSelector(selectCurrentUser);
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();

  // The auth screens and the editor have their own full-page layout.
  if (pathname === "/login" || pathname === "/register") return null;
  if (pathname === "/write" || pathname.startsWith("/write/")) return null;

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

      {user && (
        <nav aria-label="Main" className="hidden gap-1 rounded-full border border-line bg-surf p-1 md:flex">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={navLink}>
            Feed
          </Link>
          <Link
            href="/my-posts"
            aria-current={pathname === "/my-posts" ? "page" : undefined}
            className={navLink}
          >
            My posts
          </Link>
        </nav>
      )}

      <div className="flex items-center gap-2.5">
        {user ? (
          <>
            <Link href="/write" className={`${pill} bg-btn text-on-btn`}>
              Write
            </Link>
            <Link
              href={profilePath(user.username)}
              title={`Your profile, @${user.username}`}
              className="flex size-11 items-center justify-center rounded-full bg-acc font-serif text-lg text-bg no-underline"
            >
              <span aria-hidden="true">{user.username[0]?.toUpperCase()}</span>
              <span className="sr-only">Your profile, @{user.username}</span>
            </Link>
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
