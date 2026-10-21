/* Pure business rules — no server, no database. Run with `npm run test:unit`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isShortage, needsSupervisorReview } from "@/lib/config";
import { canTransition, isStandardTransition } from "@/lib/orderWorkflow";
import { isStalledInProgress, isWaitingTooLong, orderUrgency } from "@/lib/orderPresentation";
import { orderNumberPrefix } from "@/lib/orderNumber";
import { homePathFor, visibleNavLinks } from "@/lib/nav";

test("shortage: only when actual is below required", () => {
  assert.equal(isShortage(10, 9.999), true);
  assert.equal(isShortage(10, 10), false);
  assert.equal(isShortage(10, 12), false);
  assert.equal(isShortage(10, null), false, "nothing recorded yet is not a shortage");
});

test("review gate: symmetric tolerance, strictly greater than the threshold", () => {
  assert.equal(needsSupervisorReview(100, 95, 5), false, "exactly 5% is within tolerance");
  assert.equal(needsSupervisorReview(100, 94.9, 5), true);
  assert.equal(needsSupervisorReview(100, 105.1, 5), true, "over-preparing is a variance too");
  assert.equal(needsSupervisorReview(100, 92, 10), false, "threshold is a parameter, not a constant");
  assert.equal(needsSupervisorReview(100, 92, 5), true);
  assert.equal(needsSupervisorReview(0, 3, 5), false, "a zeroed line cannot divide by zero");
  assert.equal(needsSupervisorReview(100, undefined, 5), false);
  assert.equal(needsSupervisorReview(100, 0, 0), true, "a 0% tolerance flags any difference");
  assert.equal(needsSupervisorReview(100, 100, 0), false);
});

test("workflow: forward steps only, and only for the roles that own them", () => {
  assert.equal(canTransition("new", "preparing", "PREPARER"), true);
  assert.equal(canTransition("new", "preparing", "LOADER"), false);
  assert.equal(canTransition("ready_for_loading", "loading", "LOADER"), true);
  assert.equal(canTransition("ready_for_loading", "loading", "PREPARER"), false);
  assert.equal(canTransition("loaded", "dispatched", "LOADER"), true);
  assert.equal(canTransition("new", "dispatched", "SUPERVISOR"), false, "no skipping without override");
  assert.equal(canTransition("dispatched", "loaded", "SUPERVISOR"), false, "no going back");
  assert.equal(canTransition("cancelled", "new", "SUPER_ADMIN"), false, "cancelled is terminal");
  assert.equal(isStandardTransition("preparing", "ready_for_loading"), true);
  assert.equal(isStandardTransition("preparing", "loaded"), false);
});

test("time thresholds are parameters with configured defaults", () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  assert.equal(isWaitingTooLong("new", minutesAgo(21)), true, "default 20 min");
  assert.equal(isWaitingTooLong("new", minutesAgo(21), 30), false);
  assert.equal(isWaitingTooLong("preparing", minutesAgo(999)), false, "only orders not yet started");
  assert.equal(isStalledInProgress("loading", minutesAgo(46)), true, "default 45 min");
  assert.equal(isStalledInProgress("loading", minutesAgo(46), 60), false);
  assert.equal(isStalledInProgress("new", minutesAgo(999)), false, "new is 'waiting', not 'stalled'");
  assert.equal(isStalledInProgress("dispatched", minutesAgo(999)), false);
});

test("delivery urgency honours the configured 'soon' window", () => {
  const inMinutes = (m: number) => {
    const d = new Date(Date.now() + m * 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  };
  const t = inMinutes(90);
  assert.equal(orderUrgency("new", t.date, t.time), "ok", "90 min out, default window 60");
  assert.equal(orderUrgency("new", t.date, t.time, 120), "soon", "90 min out, window 120");
  const past = inMinutes(-5);
  assert.equal(orderUrgency("preparing", past.date, past.time), "late");
  assert.equal(orderUrgency("dispatched", past.date, past.time), "none", "finished orders have no urgency");
  assert.equal(orderUrgency("new", "not-a-date", null), "none");
});

test("order numbers derive from the delivery date string, never through Date parsing", () => {
  assert.equal(orderNumberPrefix("2026-01-01"), "UN-20260101-");
  assert.equal(orderNumberPrefix("2026-12-31"), "UN-20261231-");
  assert.match(orderNumberPrefix(undefined), /^UN-\d{8}-$/);
});

test("navigation and landing page follow effective permissions, not role names", () => {
  assert.equal(homePathFor(["orders.view", "orders.prepare"]), "/prep");
  assert.equal(homePathFor(["stock.view"]), "/stock");
  assert.equal(homePathFor(["users.view", "orders.prepare"]), "/admin");
  assert.equal(homePathFor([]), "/no-access");
  const links = visibleNavLinks(["orders.load", "orders.view"]).map((l) => l.href);
  assert.deepEqual(links, ["/load", "/production", "/production/sheet", "/operations"]);
});
