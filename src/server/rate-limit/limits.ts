import { clock } from "@/server/clock";
import { createRateLimiter, type RateLimiter, type RateLimitRule } from "./limiter";

const MINUTE = 60_000;
const TOO_MANY_LOGINS = "Too many login attempts. Please wait a moment and try again.";

/**
 * Every rate limit in Pencil. Later tickets add theirs here and call `rateLimiters().<name>.consume(key)`.
 */
export const RATE_LIMITS = {
  /** Keyed by client IP: stops one address guessing passwords. */
  loginPerIp: { limit: 5, windowMs: MINUTE, message: TOO_MANY_LOGINS },
  /** Keyed by email: looser, but holds across IPs, so a botnet can't spread out the guesses. */
  loginPerEmail: { limit: 10, windowMs: 15 * MINUTE, message: TOO_MANY_LOGINS },
  /** Keyed by client IP: stops account-creation bursts. */
  registerPerIp: {
    limit: 10,
    windowMs: 60 * MINUTE,
    message: "Too many sign-ups from your network. Please try again later.",
  },
  /** Keyed by client IP: stops comment spam bursts while leaving room for a real conversation. */
  commentPerIp: {
    limit: 5,
    windowMs: MINUTE,
    message: "You're commenting too fast. Please wait a moment and try again.",
  },
  /**
   * Keyed by the email asked for, known or not, so the reply is the same
   * either way: stops anyone filling one inbox with verification emails.
   */
  resendVerificationPerEmail: {
    limit: 3,
    windowMs: 60 * MINUTE,
    message: "You can ask for 3 verification emails an hour. Please try again later.",
  },
  /** Keyed by client IP: stops one address sending verification emails to many inboxes. */
  resendVerificationPerIp: {
    limit: 10,
    windowMs: 60 * MINUTE,
    message: "Too many verification emails from your network. Please try again later.",
  },
  /**
   * Keyed by the email asked for, known or not, like resend: stops anyone
   * filling one inbox with reset emails.
   */
  forgotPasswordPerEmail: {
    limit: 3,
    windowMs: 60 * MINUTE,
    message: "You can ask for 3 reset emails an hour. Please try again later.",
  },
  /** Keyed by client IP: stops one address sending reset emails to many inboxes. */
  forgotPasswordPerIp: {
    limit: 10,
    windowMs: 60 * MINUTE,
    message: "Too many reset emails from your network. Please try again later.",
  },
} satisfies Record<string, RateLimitRule>;

export type RateLimiters = Record<keyof typeof RATE_LIMITS, RateLimiter>;

// Singleton: the counters must outlive a single request (and dev hot
// reloads), so they live on globalThis like the Prisma client.
const globalForLimits = globalThis as unknown as { rateLimiters?: RateLimiters };

export function rateLimiters(): RateLimiters {
  const limiters = (globalForLimits.rateLimiters ??= {} as RateLimiters);
  // Fills in any limit missing so far, not only on the first call: a dev hot
  // reload keeps the old object, which has no entry for a newly added limit.
  for (const [name, rule] of Object.entries(RATE_LIMITS) as [keyof RateLimiters, RateLimitRule][]) {
    limiters[name] ??= createRateLimiter(rule, clock);
  }
  return limiters;
}

/** Forgets every counter. Tests call this so each test starts with fresh limits. */
export function resetRateLimiters(): void {
  globalForLimits.rateLimiters = undefined;
}
