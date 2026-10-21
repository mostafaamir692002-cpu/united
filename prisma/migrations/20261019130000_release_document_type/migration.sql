-- F-03: add "release" to the InventoryDocument type whitelist, "release_out/in" to
-- the StockMovement kind, direction, and source constraints.
-- The original constraints were defined in 20261008131333 and partly extended in
-- 20261010000002_add_produce_grading (sorting_out/in). This migration finishes the set.
ALTER TABLE "InventoryDocument" DROP CONSTRAINT "InventoryDocument_type_known";
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_type_known" CHECK ("type" IN
  ('transfer', 'adjustment', 'scrap', 'customer_return', 'supplier_return', 'issue', 'grading', 'release'));

ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_kind_known";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_kind_known" CHECK ("kind" IN
  ('intake', 'intake_correction', 'intake_void', 'adjustment',
   'transfer_out', 'transfer_in', 'issue', 'customer_return', 'supplier_return', 'scrap',
   'sorting_out', 'sorting_in', 'release_out', 'release_in'));

ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_direction_matches_kind";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_direction_matches_kind" CHECK (
  ("kind" IN ('intake', 'transfer_in', 'customer_return', 'sorting_in', 'release_in') AND "quantity" > 0)
  OR ("kind" IN ('intake_void', 'transfer_out', 'issue', 'supplier_return', 'scrap', 'sorting_out', 'release_out') AND "quantity" < 0)
  OR "kind" IN ('intake_correction', 'adjustment')
);

ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_source_matches_kind";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_source_matches_kind" CHECK (
  ("kind" IN ('intake', 'intake_correction', 'intake_void') AND "intakeId" IS NOT NULL AND "documentId" IS NULL)
  OR ("kind" = 'adjustment' AND "intakeId" IS NULL AND length(btrim(coalesce("reason", ''))) > 0)
  OR ("kind" = 'scrap' AND "intakeId" IS NULL AND "documentId" IS NOT NULL AND length(btrim(coalesce("reason", ''))) > 0)
  OR ("kind" IN ('transfer_out', 'transfer_in', 'issue', 'customer_return', 'supplier_return') AND "intakeId" IS NULL AND "documentId" IS NOT NULL)
  OR ("kind" IN ('sorting_out', 'sorting_in') AND "intakeId" IS NOT NULL AND "documentId" IS NOT NULL AND length(btrim(coalesce("reason", ''))) > 0)
  OR ("kind" IN ('release_out', 'release_in') AND "intakeId" IS NULL AND "documentId" IS NOT NULL AND length(btrim(coalesce("reason", ''))) > 0)
);