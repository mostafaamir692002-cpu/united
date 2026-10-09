import { test } from "node:test";
import assert from "node:assert/strict";
import { D } from "@/lib/inventory/decimal";
import { requiresAdjustmentApproval } from "@/lib/inventory/adjustment-rules";

test("adjustment approval threshold aggregates absolute changes per product", () => {
  assert.equal(requiresAdjustmentApproval([
    { productId: "a", quantity: "-6" },
    { productId: "a", quantity: "-6" },
  ], D(10)), true);
  assert.equal(requiresAdjustmentApproval([
    { productId: "a", quantity: "-6" },
    { productId: "b", quantity: "-6" },
  ], D(10)), false);
  assert.equal(requiresAdjustmentApproval([{ productId: "a", quantity: "-10" }], D(10)), false);
  assert.equal(requiresAdjustmentApproval([{ productId: "a", quantity: "-100" }], D(0)), false);
});
