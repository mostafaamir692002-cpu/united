/* Business-date validation: plain strings, real calendar days, no timezone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidISODate, isValidTimeOfDay } from "@/lib/dates";

test("real calendar days only", () => {
  assert.equal(isValidISODate("2026-10-08"), true);
  assert.equal(isValidISODate("2028-02-29"), true, "leap day");
  assert.equal(isValidISODate("2026-02-29"), false, "not a leap year");
  assert.equal(isValidISODate("2026-02-30"), false);
  assert.equal(isValidISODate("2026-04-31"), false);
  assert.equal(isValidISODate("2026-13-01"), false);
  assert.equal(isValidISODate("2026-00-10"), false);
  assert.equal(isValidISODate("2026-9-1"), false, "must be zero-padded");
  assert.equal(isValidISODate("2026-10-08T00:00:00Z"), false, "date only");
  assert.equal(isValidISODate("next tuesday"), false);
  assert.equal(isValidISODate(20261008), false);
  assert.equal(isValidISODate("1999-12-31"), false, "outside the business range");
});

test("24-hour HH:mm", () => {
  for (const t of ["00:00", "07:30", "23:59"]) assert.equal(isValidTimeOfDay(t), true, t);
  for (const t of ["24:00", "7:30", "07:60", "07:30:00", "", "noon"]) assert.equal(isValidTimeOfDay(t), false, t);
});
