import { clock } from "@/server/clock";
import { createRateLimiter, type RateLimiter, type RateLimitRule } from "./limiter";

const MINUTE = 60_000;
const TOO_MANY_LOGINS = "Too many login attempts. Please wait a moment and try again.";

/**
 * Every rate limit in Pencil. Later tickets add theirs here (comment
 * creation, verification resend) and call `rateLimiters().<name>.consume(key)`.
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
} satisfies Record<string, RateLimitRule>;

export type RateLimiters = Record<keyof typeof RATE_LIMITS, RateLimiter>;

// Singleton: the counters must outlive a single request (and dev hot
// reloads), so they live on globalThis like the Prisma client.
const globalForLimits = globalThis as unknown as { rateLimiters?: RateLimiters };

export function rateLimiters(): RateLimiters {
  globalForLimits.rateLimiters ??= Object.fromEntries(
    Object.entries(RATE_LIMITS).map(([name, rule]) => [name, createRateLimiter(rule, clock)]),
  ) as RateLimiters;
  return globalForLimits.rateLimiters;
}

/** Forgets every counter. Tests call this so each test starts with fresh limits. */
export function resetRateLimiters(): void {
  globalForLimits.rateLimiters = undefined;
}
