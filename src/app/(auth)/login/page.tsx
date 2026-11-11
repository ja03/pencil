import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Log in · Pencil" };

export default function LoginPage() {
  // LoginForm reads `?next=`, which is only known at request time.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
