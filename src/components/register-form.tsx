"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { apiErrorOf, useRegisterMutation } from "@/client/api";
import { signedIn } from "@/client/auth-slice";
import { useAppDispatch } from "@/client/store";
import type { FieldErrors } from "@/contracts/api-error";
import { registerInput } from "@/contracts/auth";
import { AuthHeading, FormAlert, FormField, SubmitButton } from "./form-field";

export function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [register, { isLoading }] = useRegisterMutation();
  const [fields, setFields] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    const form = new FormData(event.currentTarget);
    // Same schema the API validates with, so most mistakes show before a round trip.
    const parsed = registerInput.safeParse({
      username: form.get("username"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setFields(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }
    setFields({});

    try {
      const { user } = await register(parsed.data).unwrap();
      dispatch(signedIn(user));
      router.replace("/");
      router.refresh();
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.fields) setFields(apiError.fields);
      else setAlert(apiError?.message ?? "Couldn't reach Pencil. Check your connection and try again.");
    }
  }

  return (
    <>
      <AuthHeading eyebrow="Join Pencil" title="Create your account" />
      {alert && <FormAlert>{alert}</FormAlert>}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="username"
          name="username"
          label="Username"
          prefix="@"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={20}
          hint="3–20 characters: lowercase letters, numbers and _. You can't change it later."
          errors={fields.username}
        />
        <FormField
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          errors={fields.email}
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          errors={fields.password}
        />
        <SubmitButton pending={isLoading}>{isLoading ? "Creating account…" : "Create account"}</SubmitButton>
      </form>
      <p className="m-0 text-center text-sm text-mut">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-acc">
          Log in
        </Link>
      </p>
    </>
  );
}
