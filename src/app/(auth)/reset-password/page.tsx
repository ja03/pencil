import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password · Pencil",
  // The address carries the reset token; never pass it on to another site.
  referrer: "no-referrer",
};

/** Where the emailed reset link lands. */
export default function ResetPasswordPage() {
  // The token is in the query string, only known at request time.
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
