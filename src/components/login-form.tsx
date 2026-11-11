"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { apiErrorOf, useLoginMutation } from "@/client/api";
import { signedIn } from "@/client/auth-slice";
import { safeNext } from "@/client/safe-next";
import { useAppDispatch } from "@/client/store";
import type { FieldErrors } from "@/contracts/api-error";
import { loginInput } from "@/contracts/auth";
import { AuthHeading, FormAlert, FormField, SubmitButton } from "./form-field";

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const [fields, setFields] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    const form = new FormData(event.currentTarget);
    const parsed = loginInput.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setFields(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }
    setFields({});

    try {
      const { user } = await login(parsed.data).unwrap();
      dispatch(signedIn(user));
      router.replace(next);
      router.refresh();
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.fields) setFields(apiError.fields);
      else setAlert(apiError?.message ?? "Couldn't reach Pencil. Check your connection and try again.");
    }
  }

  // A wrong password marks both fields, since we don't say which one was wrong.
  const credentialsError = alert ? [""] : undefined;

  return (
    <>
      <AuthHeading eyebrow="Welcome back" title="Log in to Pencil" />
      {alert && <FormAlert>{alert}</FormAlert>}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          errors={fields.email ?? credentialsError}
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          aside={
            <Link href="/forgot-password" className="text-[13px] text-acc">
              Forgot password?
            </Link>
          }
          errors={fields.password ?? credentialsError}
        />
        <SubmitButton pending={isLoading}>{isLoading ? "Logging in…" : "Log in"}</SubmitButton>
      </form>
      <p className="m-0 text-center text-sm text-mut">
        New to Pencil?{" "}
        <Link href="/register" className="font-medium text-acc">
          Create an account
        </Link>
      </p>
    </>
  );
}
