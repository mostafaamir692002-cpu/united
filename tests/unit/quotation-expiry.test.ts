import { test } from "node:test";
import assert from "node:assert/strict";
import { isExpired } from "@/lib/sales/quotations";

test("an open quotation past its date is expired; on its last day it is not", () => {
  assert.equal(isExpired({ status: "sent", validUntil: "2026-10-07" }, "2026-10-08"), true);
  assert.equal(isExpired({ status: "sent", validUntil: "2026-10-08" }, "2026-10-08"), false);
  assert.equal(isExpired({ status: "draft", validUntil: "2026-10-01" }, "2026-10-08"), true);
  assert.equal(isExpired({ status: "accepted", validUntil: "2026-10-01" }, "2026-10-08"), true);
});

test("a closed quotation is never 'expired' — it already has its outcome", () => {
  for (const status of ["converted", "rejected", "cancelled"]) assert.equal(isExpired({ status, validUntil: "2020-01-01" }, "2026-10-08"), false);
});
