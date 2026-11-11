"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { apiErrorOf, useResetPasswordMutation } from "@/client/api";
import { signedIn } from "@/client/auth-slice";
import { useAppDispatch } from "@/client/store";
import type { FieldErrors } from "@/contracts/api-error";
import { PASSWORD_MIN_LENGTH, resetPasswordForm } from "@/contracts/auth";
import { AuthMessage, PRIMARY_ACTION, SECONDARY_ACTION } from "./auth-message";
import { FormAlert, FormField, SubmitButton } from "./form-field";
import { useToast } from "./toaster";

/**
 * "Choose a new password", from the emailed link's token. Saving signs this
 * browser in and every other one out. A missing, used or expired token shows
 * the expired-link screen, with a way to ask for a new one.
 */
export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [expired, setExpired] = useState(!token);
  const [fields, setFields] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    const form = new FormData(event.currentTarget);
    const parsed = resetPasswordForm.safeParse({
      token,
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors as FieldErrors;
      if (errors.token) setExpired(true);
      else setFields(errors);
      return;
    }
    setFields({});

    try {
      const { user } = await resetPassword({
        token: parsed.data.token,
        password: parsed.data.password,
      }).unwrap();
      dispatch(signedIn(user));
      toast.success("Password saved. You're logged in, and logged out everywhere else.");
      router.replace("/");
      router.refresh();
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.fields?.password) setFields(apiError.fields);
      // Any other 400 is the token: used, expired or never valid.
      else if (apiError?.code === "VALIDATION_FAILED") setExpired(true);
      else setAlert(apiError?.message ?? "Couldn't reach Pencil. Check your connection and try again.");
    }
  }

  if (expired) {
    return (
      <AuthMessage
        tone="expired"
        title="This link has expired"
        actions={
          <>
            <Link href="/forgot-password" className={PRIMARY_ACTION}>
              Send a new link
            </Link>
            <p className="m-0 text-sm text-mut">
              Or{" "}
              <Link href="/login" className={SECONDARY_ACTION}>
                go back to log in
              </Link>
            </p>
          </>
        }
      >
        <p className="m-0">
          Links work once and only for a limited time. Ask for a new one and use the latest email.
        </p>
      </AuthMessage>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 font-serif text-4xl leading-[1.05] font-normal tracking-tight sm:text-5xl">
          Choose a new password
        </h1>
        <p className="m-0 text-[15px] leading-[1.6] text-mut">
          Saving it signs you out on every other device.
        </p>
      </div>
      {alert && <FormAlert>{alert}</FormAlert>}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="password"
          name="password"
          type="password"
          label="New password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          errors={fields.password}
        />
        <FormField
          id="confirm"
          name="confirm"
          type="password"
          label="Repeat new password"
          autoComplete="new-password"
          required
          errors={fields.confirm}
        />
        <SubmitButton pending={isLoading}>{isLoading ? "Saving…" : "Save password"}</SubmitButton>
      </form>
    </>
  );
}
