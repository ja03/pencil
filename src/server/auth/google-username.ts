import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/contracts/auth";

/**
 * A username made from an email's local part, within the username rules:
 * lowercase letters, numbers and _, 3 to 20 characters.
 * "Ada.Lovelace+blog@x.com" → "ada_lovelace_blog".
 */
export function usernameBase(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
  if (cleaned.length >= USERNAME_MIN_LENGTH) return cleaned;
  return cleaned ? `${cleaned}_user` : "user";
}

/**
 * The `n`th username to try for `base`: the base itself first, then base2,
 * base3… with the base shortened so the number still fits in 20 characters.
 */
export function usernameCandidate(base: string, n: number): string {
  if (n <= 1) return base;
  const suffix = String(n);
  return `${base.slice(0, USERNAME_MAX_LENGTH - suffix.length)}${suffix}`;
}

/** Candidates `from` to `from + count - 1`, in the order to try them. */
export function usernameCandidates(base: string, from: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => usernameCandidate(base, from + i));
}
