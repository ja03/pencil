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

export const registerInput = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters.`)
    .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters.`)
    .regex(USERNAME_PATTERN, "Use only lowercase letters, numbers and _."),
  email,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
    .refine(
      (p) => new TextEncoder().encode(p).length <= PASSWORD_MAX_BYTES,
      "That password is too long.",
    ),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
export type LoginInput = z.infer<typeof loginInput>;

/** The signed-in user as the API and client see it. Never includes secrets. */
export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
};

/** Body of register, login and current-user responses. */
export type AuthResponse = { user: CurrentUser };
