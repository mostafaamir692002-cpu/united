import { test } from "node:test";
import assert from "node:assert/strict";
import { lineAmounts, sumAmounts } from "@/lib/sales/money";

const s = (a: ReturnType<typeof lineAmounts>) => [a.gross, a.discount, a.net, a.tax, a.total].map((x) => x.toFixed(2));

test("exempt line: quantity × price, no tax", () => {
  assert.deepEqual(s(lineAmounts({ quantity: "12.5", unitPrice: "18.40" })), ["230.00", "0.00", "230.00", "0.00", "230.00"]);
});

test("discount then 14% VAT on the net", () => {
  // 3 × 99.99 = 299.97; 10% = 30.00 (29.997 half-up); net 269.97; VAT 37.7958 → 37.80
  assert.deepEqual(s(lineAmounts({ quantity: 3, unitPrice: "99.99", discountPct: 10, taxRate: 14 })), ["299.97", "30.00", "269.97", "37.80", "307.77"]);
});

test("no float drift: 0.1 × 3 is exactly 0.30", () => {
  assert.equal(lineAmounts({ quantity: 3, unitPrice: "0.1" }).total.toFixed(2), "0.30");
});

test("weights to 3 dp and 4-dp prices round once, per line, half-up", () => {
  // 1.235 kg × 10.0050 = 12.3561… → 12.36
  assert.equal(lineAmounts({ quantity: "1.235", unitPrice: "10.0050" }).gross.toFixed(2), "12.36");
  // exactly half a piastre rounds up
  assert.equal(lineAmounts({ quantity: 1, unitPrice: "0.005" }).gross.toFixed(2), "0.01");
});

test("totals are the sum of rounded lines", () => {
  const t = sumAmounts([lineAmounts({ quantity: 1, unitPrice: "0.333" }), lineAmounts({ quantity: 1, unitPrice: "0.333" }), lineAmounts({ quantity: 1, unitPrice: "0.333" })]);
  assert.equal(t.total.toFixed(2), "0.99");
});

test("100% discount leaves nothing to tax", () => {
  assert.deepEqual(s(lineAmounts({ quantity: 2, unitPrice: 50, discountPct: 100, taxRate: 14 })), ["100.00", "100.00", "0.00", "0.00", "0.00"]);
});
