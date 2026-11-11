import { setClock } from "@/server/clock";

/**
 * Freezes the app's clock at `start` and returns a handle to move it.
 * The per-test setup puts the system clock back afterwards.
 *
 *   const time = fakeClock();
 *   time.advance(60_000);
 */
export function fakeClock(start = new Date("2026-01-01T00:00:00Z")) {
  let now = start.getTime();
  setClock({ now: () => new Date(now) });
  return {
    advance(ms: number) {
      now += ms;
    },
  };
}
