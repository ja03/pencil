import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot your password? · Pencil" };

/** Asks for a reset link by email. Open to anyone, signed in or not. */
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
