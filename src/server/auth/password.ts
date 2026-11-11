import bcrypt from "bcryptjs";
import { env } from "@/server/env";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env().BCRYPT_ROUNDS);
}

// Compared against when the account doesn't exist (or has no password), so a
// failed login takes the same time either way and doesn't reveal which emails
// have accounts. Generated once, lazily, at the configured cost.
let dummyHash: Promise<string> | undefined;

/** True when `password` matches `hash`. A missing hash never matches. */
export async function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    dummyHash ??= bcrypt.hash("pencil-dummy-password", env().BCRYPT_ROUNDS);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}
