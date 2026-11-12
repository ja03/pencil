import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/page-transition";
import { VerifyEmailConfirm } from "@/components/verify-email-confirm";

export const metadata: Metadata = { title: "Confirm your email · Pencil" };

/** Where the emailed verification link lands. Works signed in or out. */
export default function ConfirmPage() {
  // The token is in the query string, only known at request time.
  return (
    <PageTransition>
      <Suspense>
        <VerifyEmailConfirm />
      </Suspense>
    </PageTransition>
  );
}
