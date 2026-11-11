import type { Clock } from "@/server/clock";
import { ApiError } from "@/server/http/errors";

/** At most `limit` attempts per key in each window of `windowMs`. */
export type RateLimitRule = {
  limit: number;
  windowMs: number;
  /** What the 429 tells the user. */
  message: string;
};

export type RateLimiter = {
  /**
   * Counts one attempt for `key`. Once the key has used up its window, ends
   * the request with 429 (shared error shape, plus `Retry-After`) until the
   * window resets. Blocked attempts don't count, so waiting always works.
   */
  consume(key: string): void;
};

// Expired windows are swept only once the map grows this large, so memory
// stays bounded without a timer.
const SWEEP_AT = 10_000;

type Window = { startedAt: number; count: number };

/**
 * An in-memory fixed-window limiter. State lives in this process only, which
 * is enough for Pencil's single container. `clock` is injected so tests can
 * move time instead of waiting for a window to pass.
 */
export function createRateLimiter(rule: RateLimitRule, clock: Clock): RateLimiter {
  const windows = new Map<string, Window>();

  const expired = (window: Window, now: number) => now - window.startedAt >= rule.windowMs;

  function sweep(now: number) {
    for (const [key, window] of windows) {
      if (expired(window, now)) windows.delete(key);
    }
  }

  return {
    consume(key) {
      const now = clock.now().getTime();
      let window = windows.get(key);
      if (!window || expired(window, now)) {
        if (windows.size >= SWEEP_AT) sweep(now);
        window = { startedAt: now, count: 0 };
        windows.set(key, window);
      }
      if (window.count >= rule.limit) {
        const retryAfterSeconds = Math.ceil((window.startedAt + rule.windowMs - now) / 1000);
        throw new ApiError("RATE_LIMITED", rule.message, undefined, {
          "Retry-After": String(Math.max(retryAfterSeconds, 1)),
        });
      }
      window.count += 1;
    },
  };
}
