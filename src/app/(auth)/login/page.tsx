import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { GoogleSignIn } from "@/components/google-sign-in";
import { PageTransition } from "@/components/page-transition";
import { SignedOutOnly } from "@/components/signed-out-only";

export const metadata: Metadata = { title: "Log in · Pencil" };

export default function LoginPage() {
  // The session cookie and LoginForm's `?next=` are only known at request time.
  return (
    <PageTransition>
      <Suspense>
        <SignedOutOnly>
          <LoginForm google={<GoogleSignIn context="signin" />} />
        </SignedOutOnly>
      </Suspense>
    </PageTransition>
  );
}
