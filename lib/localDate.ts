/**
 * The business runs on Cairo local time regardless of where the server process
 * happens to execute. `new Date().getFullYear()` et al read the PROCESS's own
 * timezone, which is only "correct" by accident when the host happens to be
 * configured for Cairo — a redeploy to a platform that defaults to UTC (most
 * serverless/container platforms do) would silently shift every "today" boundary
 * by up to three hours with no error anywhere. A fixed "+2" offset would be wrong
 * too: Egypt has observed seasonal DST since 2023, so the real offset changes
 * twice a year. Going through `Intl` with an explicit IANA zone is correct in
 * every deployment environment and every season, with no configuration required.
 */
const BUSINESS_TZ = "Africa/Cairo";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TZ,
  timeZoneName: "longOffset",
});

/** YYYY-MM-DD for "today" in the business's own calendar day — not
 * `new Date().toISOString().slice(0,10)`, which reads in UTC and rolls back to
 * "yesterday" during early-morning hours in any timezone ahead of UTC (e.g.
 * midnight in Cairo is still 21:00-22:00 the previous day in UTC). */
export function todayLocalISO(d = new Date()) {
  return isoDateFormatter.format(d);
}

/** The UTC instant of local midnight for the given business day (today by
 * default) — for querying timestamp columns against a calendar-day boundary. */
export function startOfBusinessDay(d = new Date()): Date {
  const dateStr = isoDateFormatter.format(d);
  const offsetName = offsetFormatter.formatToParts(d).find((p) => p.type === "timeZoneName")?.value;
  const offset = offsetName?.replace("GMT", "") || "+00:00";
  return new Date(`${dateStr}T00:00:00${offset}`);
}

/** Start of the NEXT business day — an exclusive upper bound for a "today" range query. */
export function endOfBusinessDay(d = new Date()): Date {
  return startOfBusinessDay(new Date(d.getTime() + 24 * 60 * 60 * 1000));
}
