"use client";

import { selectCurrentUser } from "@/client/auth-slice";
import { useAppSelector } from "@/client/store";
import { ResendVerificationButton } from "./resend-verification-button";

/**
 * The strip above the page that tells a signed-in, unverified user what they
 * can't do yet, with a way to get a new link. Renders nothing for anyone else.
 */
export function VerifyBanner({
  message = "Verify your email to publish, like and comment.",
}: {
  message?: string;
}) {
  const user = useAppSelector(selectCurrentUser);
  if (!user || user.emailVerified) return null;

  return (
    <div
      role="region"
      aria-label="Email verification"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 bg-warn-bg px-5 py-2.5 text-center text-[13px] leading-[1.4] text-warn-ink"
    >
      <span>{message}</span>
      <ResendVerificationButton
        email={user.email}
        className="min-h-6 cursor-pointer bg-transparent p-0 font-semibold text-warn-ink underline underline-offset-2 disabled:cursor-wait disabled:opacity-70"
      />
    </div>
  );
}
