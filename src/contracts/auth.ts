// Shared by the API and the client: auth request and response shapes.
import { z } from "zod";

export const USERNAME_PATTERN = /^[a-z0-9_]+$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;
// bcrypt only reads the first 72 bytes, so longer passwords would be
// silently truncated.
const PASSWORD_MAX_BYTES = 72;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

/** The rules for any password a user chooses: on register and on reset. */
const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .refine(
    (p) => new TextEncoder().encode(p).length <= PASSWORD_MAX_BYTES,
    "That password is too long.",
  );

export const registerInput = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters.`)
    .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters.`)
    .regex(USERNAME_PATTERN, "Use only lowercase letters, numbers and _."),
  email,
  password: newPassword,
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
export type LoginInput = z.infer<typeof loginInput>;

/** The token from an emailed link. */
const linkToken = z.string().min(1, "This link is missing its token.").max(200);

export const verifyEmailInput = z.object({ token: linkToken });
export type VerifyEmailInput = z.infer<typeof verifyEmailInput>;

/** After verifying: whoever is signed in on this browser, if anyone, as they are now. */
export type VerifyEmailResponse = { user: CurrentUser | null };

export const resendVerificationInput = z.object({ email });
export type ResendVerificationInput = z.infer<typeof resendVerificationInput>;

/**
 * The only reply resend and forgot password ever give, so neither reveals
 * whether an account exists (or, for resend, is already verified).
 */
export const EMAIL_LINK_REPLY = "If that email exists, we sent a link.";
export type ResendVerificationResponse = { message: typeof EMAIL_LINK_REPLY };

export const forgotPasswordInput = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>;
export type ForgotPasswordResponse = { message: typeof EMAIL_LINK_REPLY };

export const resetPasswordInput = z.object({ token: linkToken, password: newPassword });
export type ResetPasswordInput = z.infer<typeof resetPasswordInput>;

/**
 * The reset form: the API's input plus the repeated password, which only the
 * browser checks, since the API never sees it.
 */
export const resetPasswordForm = resetPasswordInput
  .extend({ confirm: z.string() })
  .refine((form) => form.confirm === form.password, {
    path: ["confirm"],
    message: "The passwords don't match.",
  });

/** The signed-in user as the API and client see it. Never includes secrets. */
export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
};

/** Body of register, login and current-user responses. */
export type AuthResponse = { user: CurrentUser };
