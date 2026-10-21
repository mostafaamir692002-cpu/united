/**
 * Deterministic "business day" helpers for e2e suites.
 *
 * The app books documents on the Africa/Cairo calendar day (see lib/localDate.ts),
 * NOT on the test process's own timezone. Between ~22:00 and 01:00 UTC the two
 * calendars disagree, and any suite that computes "today" from
 * `new Date(Date.now() - getTimezoneOffset()...)` goes stale at exactly the hour
 * the accounting period rolls over — posting documents on day X then asking
 * reports for day Y. These helpers mirror the app's exact Intl semantics so the
 * suites are deterministic in every environment and every season.
 */
const BUSINESS_TZ = "Africa/Cairo";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD for "today" in the business calendar — same source as the app. */
export const todayBiz = () => isoDateFormatter.format(new Date());

/** YYYY-MM-DD offset by N business days (off = 0 today, +1 tomorrow, -1 yesterday). */
export function bizDay(offsetDays = 0): string {
  const base = new Date();
  const target = new Date(base.getTime() + offsetDays * 86_400_000);
  return isoDateFormatter.format(target);
}

/** Alias kept for suites that spelled it `local(...)`. */
export const local = (offsetDays = 0) => bizDay(offsetDays);