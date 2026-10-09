import { test } from "node:test";
import assert from "node:assert/strict";
import { egpCurrencyCode, assertEgpCurrency } from "@/lib/core/currency";

test("the accepted ledger currency is Egyptian pounds, normalized to EGP", () => {
  assert.deepEqual(egpCurrencyCode.parse("egp"), "EGP");
  assert.equal(egpCurrencyCode.safeParse("USD").success, false);
  assert.equal(egpCurrencyCode.safeParse("EUR").success, false);
});

test("posting guards reject legacy foreign-currency documents", () => {
  assert.doesNotThrow(() => assertEgpCurrency("EGP", "فاتورة"));
  assert.throws(() => assertEgpCurrency("USD", "فاتورة"), /الجنيه المصري فقط/);
});
