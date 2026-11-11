"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { apiErrorOf, useForgotPasswordMutation } from "@/client/api";
import type { FieldErrors } from "@/contracts/api-error";
import { forgotPasswordInput } from "@/contracts/auth";
import { AuthMessage, PRIMARY_ACTION, SECONDARY_ACTION } from "./auth-message";
import { FormAlert, FormField, SubmitButton } from "./form-field";

/**
 * The "Forgot your password?" form, then the "Check your email" screen. The
 * reply is the same whether or not the email has an account, so the screen
 * says so too.
 */
export function ForgotPasswordForm() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [sent, setSent] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    const parsed = forgotPasswordInput.safeParse({
      email: new FormData(event.currentTarget).get("email"),
    });
    if (!parsed.success) {
      setFields(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }
    setFields({});

    try {
      await forgotPassword(parsed.data).unwrap();
      setSent(true);
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.fields) setFields(apiError.fields);
      else setAlert(apiError?.message ?? "Couldn't reach Pencil. Check your connection and try again.");
    }
  }

  if (sent) {
    return (
      <AuthMessage
        tone="mail"
        title="Check your email"
        actions={
          <>
            <Link href="/login" className={PRIMARY_ACTION}>
              Back to log in
            </Link>
            <p className="m-0 text-sm text-mut">
              Didn&apos;t get it?{" "}
              <button type="button" onClick={() => setSent(false)} className={SECONDARY_ACTION}>
                Try another email
              </button>
            </p>
          </>
        }
      >
        <p className="m-0">
          If that email has an account, we sent a link to reset your password. It expires in one
          hour.
        </p>
      </AuthMessage>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-mut no-underline hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
        Back to log in
      </Link>
      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 font-serif text-4xl leading-[1.05] font-normal tracking-tight sm:text-5xl">
          Forgot your password?
        </h1>
        <p className="m-0 text-[15px] leading-[1.6] text-mut">
          Enter your email and we&apos;ll send a link to choose a new one. The link works once, for
          one hour.
        </p>
      </div>
      {alert && <FormAlert>{alert}</FormAlert>}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          errors={fields.email}
        />
        <SubmitButton pending={isLoading}>{isLoading ? "Sending…" : "Send reset link"}</SubmitButton>
      </form>
    </>
  );
}
