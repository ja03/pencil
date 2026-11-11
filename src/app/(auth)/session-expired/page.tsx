import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNext } from "@/client/safe-next";
import { AuthMessage, PRIMARY_ACTION, SECONDARY_ACTION } from "@/components/auth-message";
import { getCurrentUser } from "@/server/auth/service";

export const metadata: Metadata = { title: "Session expired · Pencil" };

type Props = PageProps<"/session-expired">;

/**
 * Where a signed-in-only page sends a session that expired or was revoked
 * (a password reset, or the account was deleted), with `?next=` the page they
 * were opening, so logging in again takes them back there.
 */
export default function SessionExpiredPage({ searchParams }: Props) {
  // The session and `?next=` are only known at request time.
  return (
    <Suspense>
      <SessionExpired searchParams={searchParams} />
    </Suspense>
  );
}

async function SessionExpired({ searchParams }: Pick<Props, "searchParams">) {
  const { next } = await searchParams;
  const destination = safeNext(typeof next === "string" ? next : null);
  // Logged in again since (another tab, say): nothing has expired any more.
  if (await getCurrentUser(await cookies())) redirect(destination);

  const login = destination === "/" ? "/login" : `/login?next=${encodeURIComponent(destination)}`;
  return (
    <AuthMessage
      tone="expired"
      title="Your session has expired"
      actions={
        <>
          <Link href={login} className={PRIMARY_ACTION}>
            Log in again
          </Link>
          <p className="m-0 text-sm text-mut">
            Or{" "}
            <Link href="/" className={SECONDARY_ACTION}>
              go back to the feed
            </Link>
          </p>
        </>
      }
    >
      <p className="m-0">
        You&apos;ve been logged out. Sessions end after 7 days, and straight away on every device
        when your password changes. Log in again to pick up where you left off.
      </p>
    </AuthMessage>
  );
}
