import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/register-form";
import { SignedOutOnly } from "@/components/signed-out-only";

export const metadata: Metadata = { title: "Create your account · Pencil" };

export default function RegisterPage() {
  // The session cookie is only known at request time.
  return (
    <Suspense>
      <SignedOutOnly>
        <RegisterForm />
      </SignedOutOnly>
    </Suspense>
  );
}
