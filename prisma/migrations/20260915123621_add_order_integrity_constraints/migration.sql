-- ---------------------------------------------------------------------------
-- Production readiness audit: Order/OrderItem were the one pair of tables in
-- the schema with no CHECK constraints backing their invariants — every other
-- table (User, Supplier, StockProduct, StockIntake, StockMovement, Permission,
-- RolePermission, UserPermissionOverride, ProductAlias) already has this
-- defense-in-depth layer, but the most heavily written table in the system did
-- not. The app layer already enforces every one of these; this only means a
-- bad row can no longer be written by a future code path, a migration script,
-- or a hand-written SQL fix that forgets to.
-- ---------------------------------------------------------------------------

ALTER TABLE "Order" ADD CONSTRAINT "Order_status_known"
  CHECK ("status" IN ('new', 'preparing', 'ready_for_loading', 'loading', 'loaded', 'dispatched', 'cancelled'));
ALTER TABLE "Order" ADD CONSTRAINT "Order_source_known"
  CHECK ("source" IN ('manual', 'system', 'n8n', 'hermes'));
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryDate_format" CHECK ("deliveryDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryTime_format" CHECK ("deliveryTime" IS NULL OR "deliveryTime" ~ '^[0-9]{2}:[0-9]{2}$');
ALTER TABLE "Order" ADD CONSTRAINT "Order_crateCount_non_negative" CHECK ("crateCount" IS NULL OR "crateCount" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_orderNumber_not_blank" CHECK (length(btrim("orderNumber")) > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerName_not_blank" CHECK (length(btrim("customerName")) > 0);

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_preparationStatus_known"
  CHECK ("preparationStatus" IN ('pending', 'done'));
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_loadingStatus_known"
  CHECK ("loadingStatus" IN ('pending', 'done'));
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_requiredQuantity_non_negative" CHECK ("requiredQuantity" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_preparedQuantity_non_negative" CHECK ("preparedQuantity" IS NULL OR "preparedQuantity" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_loadedQuantity_non_negative" CHECK ("loadedQuantity" IS NULL OR "loadedQuantity" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unit_not_blank" CHECK (length(btrim("unit")) > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productName_not_blank" CHECK (length(btrim("productName")) > 0);

-- ---------------------------------------------------------------------------
-- Two RolePermission/UserPermissionOverride foreign keys had no covering
-- index (flagged by the Supabase performance advisor). Both tables are tiny,
-- so this is not an active bottleneck, but syncPermissionCatalogue() deletes
-- stale Permission rows on every deploy, which cascade-deletes here — without
-- an index that cascade is a sequential scan.
-- ---------------------------------------------------------------------------

CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
CREATE INDEX "UserPermissionOverride_permissionId_idx" ON "UserPermissionOverride"("permissionId");
