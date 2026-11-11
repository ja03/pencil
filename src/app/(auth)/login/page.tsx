import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { SignedOutOnly } from "@/components/signed-out-only";

export const metadata: Metadata = { title: "Log in · Pencil" };

export default function LoginPage() {
  // The session cookie and LoginForm's `?next=` are only known at request time.
  return (
    <Suspense>
      <SignedOutOnly>
        <LoginForm />
      </SignedOutOnly>
    </Suspense>
  );
}
