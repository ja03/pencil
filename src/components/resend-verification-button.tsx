"use client";

import type { ReactNode } from "react";
import { apiErrorOf, useResendVerificationMutation } from "@/client/api";
import { useToast } from "./toaster";

/** Each resend's toast replaces the last, so repeated clicks don't stack up. */
const RESEND_TOAST = { key: "resend-verification" };

/**
 * Asks for a new verification email for `email`. The reply is the same
 * whether or not the account exists, so it is shown as is; a 429 says when
 * to try again.
 */
export function ResendVerificationButton({
  email,
  className,
  children = "Resend verification",
}: {
  email: string;
  className: string;
  children?: ReactNode;
}) {
  const toast = useToast();
  const [resend, { isLoading }] = useResendVerificationMutation();

  async function onClick() {
    try {
      const { message } = await resend({ email }).unwrap();
      toast.success(message, RESEND_TOAST);
    } catch (error) {
      toast.error(
        apiErrorOf(error)?.message ?? "Couldn't reach Pencil. Check your connection and try again.",
        RESEND_TOAST,
      );
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={isLoading}
      aria-busy={isLoading || undefined}
      className={className}
    >
      {isLoading ? "Sending…" : children}
    </button>
  );
}
