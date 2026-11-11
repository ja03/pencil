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
