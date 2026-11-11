import { describe, expect, it } from "vitest";
import { timeAgo } from "./format";

const now = new Date("2026-11-11T12:00:00.000Z");
const before = (ms: number) => new Date(now.getTime() - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("timeAgo", () => {
  it.each([
    [0, "Just now"],
    [59_999, "Just now"],
    [MINUTE, "1 minute ago"],
    [5 * MINUTE + 30_000, "5 minutes ago"],
    [HOUR, "1 hour ago"],
    [23 * HOUR, "23 hours ago"],
    [DAY, "Yesterday"],
    [3 * DAY, "3 days ago"],
    [7 * DAY - 1, "6 days ago"],
    [7 * DAY, "Nov 4"],
  ])("%d ms ago reads %s", (ms, text) => {
    expect(timeAgo(before(ms), now)).toBe(text);
  });

  it("shows the year for comments from another year", () => {
    expect(timeAgo("2025-12-30T08:00:00.000Z", now)).toBe("Dec 30, 2025");
  });

  it("treats a time slightly ahead of the clock as just now", () => {
    expect(timeAgo(new Date(now.getTime() + 5000).toISOString(), now)).toBe("Just now");
  });
});
