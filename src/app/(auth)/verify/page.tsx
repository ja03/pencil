import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthMessage, PRIMARY_ACTION, SECONDARY_ACTION } from "@/components/auth-message";
import { PageTransition } from "@/components/page-transition";
import { ResendVerificationButton } from "@/components/resend-verification-button";
import { getCurrentUser } from "@/server/auth/service";

export const metadata: Metadata = { title: "Verify your email · Pencil" };

/** "Check your email": where registering lands, with a way to resend the link. */
export default function VerifyPage() {
  // Who is asking is only known at request time.
  return (
    <PageTransition>
      <Suspense>
        <CheckYourEmail />
      </Suspense>
    </PageTransition>
  );
}

async function CheckYourEmail() {
  const user = await getCurrentUser(await cookies());
  if (!user) redirect("/login?next=/verify");
  if (user.emailVerified) redirect("/");

  return (
    <AuthMessage
      tone="mail"
      title="Verify your email"
      actions={
        <>
          <Link href="/" className={PRIMARY_ACTION}>
            Go to the feed
          </Link>
          <p className="m-0 text-sm text-mut">
            No email?{" "}
            <ResendVerificationButton email={user.email} className={SECONDARY_ACTION}>
              Resend link (up to 3 per hour)
            </ResendVerificationButton>
          </p>
        </>
      }
    >
      <p className="m-0">
        We sent a link to <strong className="font-semibold text-ink">{user.email}</strong>. Open it
        within 24 hours to publish, like and comment. Until then you can read and write drafts.
      </p>
    </AuthMessage>
  );
}
