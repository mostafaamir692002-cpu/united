/* Three-way match of supplier bills: per-line judgement, tolerance boundary, unpriced lines. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { matchBill } from "../../lib/purchasing/match";

const D = (v: string) => new Prisma.Decimal(v);
const line = (net: string, expectedNet: string | null) => ({ net: D(net), expectedNet: expectedNet == null ? null : D(expectedNet) });

test("exact match posts without approval", () => {
  const m = matchBill([line("4350.00", "4350.00"), line("590.00", "590.00")], 1);
  assert.equal(m.status, "matched");
  assert.equal(m.needsApproval, false);
  assert.equal(m.variance.toFixed(2), "0.00");
  assert.equal(m.expectedNet.toFixed(2), "4940.00");
});

test("the tolerance boundary is inclusive, per line", () => {
  assert.equal(matchBill([line("1010.00", "1000.00")], 1).status, "within_tolerance");
  assert.equal(matchBill([line("990.00", "1000.00")], 1).status, "within_tolerance");
  const over = matchBill([line("1010.01", "1000.00")], 1);
  assert.equal(over.status, "variance");
  assert.equal(over.needsApproval, true);
  assert.equal(over.variance.toFixed(2), "10.01");
});

test("an over-charge on one line cannot hide behind an under-charge on another", () => {
  const m = matchBill([line("1100.00", "1000.00"), line("900.00", "1000.00")], 1);
  assert.equal(m.variance.toFixed(2), "0.00", "the bill nets to zero…");
  assert.equal(m.status, "variance", "…but each line is judged on its own");
});

test("a line with nothing agreed needs approval and adds no variance", () => {
  const m = matchBill([line("500.00", "500.00"), line("127.50", null)], 50);
  assert.equal(m.status, "unpriced");
  assert.equal(m.needsApproval, true);
  assert.equal(m.variance.toFixed(2), "0.00");
  assert.equal(m.expectedNet.toFixed(2), "500.00");
});

test("zero tolerance: any difference is a variance", () => {
  assert.equal(matchBill([line("100.01", "100.00")], 0).status, "variance");
  assert.equal(matchBill([line("100.00", "100.00")], 0).status, "matched");
});
