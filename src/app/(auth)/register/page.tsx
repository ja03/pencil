import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Create your account · Pencil" };

export default function RegisterPage() {
  return <RegisterForm />;
}
