"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiErrorOf, useVerifyEmailMutation } from "@/client/api";
import { selectCurrentUser, signedIn } from "@/client/auth-slice";
import { useAppDispatch, useAppSelector } from "@/client/store";
import type { VerifyEmailResponse } from "@/contracts/auth";
import { AuthMessage, PRIMARY_ACTION, SECONDARY_ACTION } from "./auth-message";
import { ResendVerificationButton } from "./resend-verification-button";

type Outcome = "verifying" | "verified" | "expired" | "offline";

type Attempt = Promise<
  { outcome: "verified"; response: VerifyEmailResponse } | { outcome: "expired" | "offline" }
>;

// A link works once, so each token is sent at most once per page load, even
// when React runs the effect twice in development.
const attempts = new Map<string, Attempt>();

/**
 * Uses the token from the verification link, then shows the "You're
 * verified" screen, or the expired-link screen when the API rejects it.
 * Verifying is a POST from the page, never the GET that opens the link, so a
 * mail scanner that previews links can't use the token up.
 */
export function VerifyEmailConfirm() {
  const token = useSearchParams().get("token");
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const [verify] = useVerifyEmailMutation();
  const [outcome, setOutcome] = useState<Outcome>(token ? "verifying" : "expired");
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (!token) return;
    let attempt = attempts.get(token);
    if (!attempt) {
      attempt = verify({ token })
        .unwrap()
        .then(
          (response) => ({ outcome: "verified", response }) as const,
          (error) => ({ outcome: apiErrorOf(error) ? "expired" : "offline" }) as const,
        );
      attempts.set(token, attempt);
    }
    let current = true;
    void attempt.then((result) => {
      if (!current) return;
      if (result.outcome === "offline") attempts.delete(token);
      if (result.outcome === "verified") {
        if (result.response.user) dispatch(signedIn(result.response.user));
        // The token is spent; keep it out of the address bar and history.
        window.history.replaceState(null, "", "/verify/confirm");
      }
      setOutcome(result.outcome);
    });
    return () => {
      current = false;
    };
  }, [token, verify, dispatch, retries]);

  switch (outcome) {
    case "verifying":
      return (
        <AuthMessage tone="mail" title="Verifying your email" busy>
          <p className="m-0">One moment while we confirm your link…</p>
        </AuthMessage>
      );

    case "verified":
      return (
        <AuthMessage
          tone="success"
          title="You're verified"
          actions={
            <Link href="/write" className={PRIMARY_ACTION}>
              Write your first post
            </Link>
          }
        >
          <p className="m-0">Your email is confirmed. You can now publish posts, like and comment.</p>
        </AuthMessage>
      );

    case "offline":
      return (
        <AuthMessage
          tone="expired"
          title="Couldn't reach Pencil"
          actions={
            <button
              type="button"
              onClick={() => {
                setOutcome("verifying");
                setRetries((n) => n + 1);
              }}
              className={PRIMARY_ACTION}
            >
              Try again
            </button>
          }
        >
          <p className="m-0">Your link hasn&apos;t been used yet. Check your connection and try again.</p>
        </AuthMessage>
      );

    case "expired":
      return (
        <AuthMessage
          tone="expired"
          title="This link has expired"
          actions={
            !user ? (
              <>
                <Link href="/login?next=/verify" className={PRIMARY_ACTION}>
                  Log in to get a new link
                </Link>
                <p className="m-0 text-sm text-mut">
                  Or{" "}
                  <Link href="/" className={SECONDARY_ACTION}>
                    go back to the feed
                  </Link>
                </p>
              </>
            ) : user.emailVerified ? (
              <Link href="/" className={PRIMARY_ACTION}>
                Go to the feed
              </Link>
            ) : (
              <>
                <ResendVerificationButton email={user.email} className={PRIMARY_ACTION}>
                  Send a new link
                </ResendVerificationButton>
                <p className="m-0 text-sm text-mut">
                  Or{" "}
                  <Link href="/" className={SECONDARY_ACTION}>
                    go back to the feed
                  </Link>
                </p>
              </>
            )
          }
        >
          <p className="m-0">
            {user?.emailVerified
              ? "Links work once and only for a limited time. Your email is already verified, so there's nothing more to do."
              : "Links work once and only for a limited time. Ask for a new one and use the latest email."}
          </p>
        </AuthMessage>
      );
  }
}
