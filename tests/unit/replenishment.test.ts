import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestedReplenishment } from "@/lib/purchasing/replenishment-rules";

test("replenishment stays quiet above the reorder trigger and orders up to max below it", () => {
  assert.equal(suggestedReplenishment("12", "10", "30"), null);
  assert.equal(suggestedReplenishment("8", "10", "30")?.toFixed(3), "22.000");
});

test("without a max, replenish only back to the trigger; invalid legacy ranges are skipped", () => {
  assert.equal(suggestedReplenishment("3", "10", null)?.toFixed(3), "7.000");
  assert.equal(suggestedReplenishment("3", "10", "8"), null);
  assert.equal(suggestedReplenishment("3", null, "8"), null);
});
