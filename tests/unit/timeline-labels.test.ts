/* The order timeline is read by the floor: every event an order can carry reads as Arabic,
   never as a database action key — including events this module has not met yet. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline } from "../../lib/auditLabels";
import type { AuditLogDTO } from "../../lib/client-types";

const ORDER_ACTIONS = [
  "order_created", "status_changed", "status_override", "prepared_quantity_set", "item_marked_prepared", "loaded_quantity_set",
  "item_marked_loaded", "required_quantity_edited", "shortage_approved", "order_edited", "order_cloned", "order_cancelled", "order_reopened",
  "order_assigned", "approval_requested", "approval_level_approved", "approval_approved", "approval_rejected", "approval_cancelled",
  "stock_issue_exception_raised", "stock_issue_exception_resolved", "stock_issue_exception_voided", "inventory_issue_posted",
  "order_customer_mapped", "order_product_mapped", "order_product_unmapped", "order_priced", "order_line_price_overridden",
  "order_credit_evaluated", "attachment_added", "attachment_removed", "some_future_action",
];

const row = (action: string, i: number) =>
  ({ id: String(i), action, userName: "سارة", timestamp: new Date(2026, 0, 1, 0, i).toISOString(), source: "user", reason: null, fieldChanged: null, oldValue: null, newValue: "x", itemName: "طماطم", itemUnit: "KG" }) as unknown as AuditLogDTO;

test("no order event shows its raw action key", () => {
  const events = buildTimeline(ORDER_ACTIONS.map(row));
  assert.equal(events.length, ORDER_ACTIONS.length);
  for (const e of events) assert.doesNotMatch(e.headline, /^[a-z_]+$/, `raw key in timeline: ${e.headline}`);
});
