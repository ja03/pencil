/** Where the server reads the current time from. */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };

let override: Clock | undefined;

/**
 * The app's clock. Code that depends on time windows (rate limits, token
 * expiry) reads it here, so tests can move time with `setClock` instead of
 * waiting.
 */
export const clock: Clock = { now: () => (override ?? systemClock).now() };

/** Replaces the app's clock; pass nothing to go back to the system clock. Tests only. */
export function setClock(next?: Clock): void {
  override = next;
}
