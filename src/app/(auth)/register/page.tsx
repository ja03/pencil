import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/page-transition";
import { RegisterForm } from "@/components/register-form";
import { GoogleSignIn } from "@/components/google-sign-in";
import { SignedOutOnly } from "@/components/signed-out-only";

export const metadata: Metadata = { title: "Create your account · Pencil" };

export default function RegisterPage() {
  // The session cookie is only known at request time.
  return (
    <PageTransition>
      <Suspense>
        <SignedOutOnly>
          <RegisterForm google={<GoogleSignIn context="signup" />} />
        </SignedOutOnly>
      </Suspense>
    </PageTransition>
  );
}
