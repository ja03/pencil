// Dates are formatted in UTC so the server render and the browser agree,
// whatever time zone either one runs in.

const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const monthAndYear = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "Nov 10" this year, "Nov 10, 2025" otherwise. For cards. */
export function shortDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return date.getUTCFullYear() === now.getUTCFullYear()
    ? dayMonth.format(date)
    : fullDate.format(date);
}

/** "Nov 10, 2026". For the post page. */
export function longDate(iso: string): string {
  return fullDate.format(new Date(iso));
}

/** "March 2026". For "Writing on Pencil since…". */
export function monthYear(iso: string): string {
  return monthAndYear.format(new Date(iso));
}

const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago",
 * then the short date from a week on. For comments.
 */
export function timeAgo(iso: string, now = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());
  if (elapsed < MINUTE) return "Just now";
  if (elapsed >= 7 * DAY) return shortDate(iso, now);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    elapsed < HOUR
      ? [Math.floor(elapsed / MINUTE), "minute"]
      : elapsed < DAY
        ? [Math.floor(elapsed / HOUR), "hour"]
        : [Math.floor(elapsed / DAY), "day"];
  const text = relative.format(-value, unit);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
