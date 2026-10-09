-- ---------------------------------------------------------------------------
-- Order integrity hardening (ERP Phase 1).
--
-- 1. Order.externalId becomes UNIQUE. Idempotency of n8n / Hermes intake used to
--    rest only on an advisory lock inside the order service; any other write path
--    could create a second order for the same external message. A unique index
--    makes that impossible. (NULLs stay allowed and do not collide.)
--
--    Pre-flight: if duplicates already exist, this migration STOPS with an
--    explanation instead of choosing which order "wins" — that is a business
--    decision about real orders, not something a migration may guess.
--    (Delivery date/time format CHECKs already exist since
--    20260915123621_add_order_integrity_constraints; nothing to add there.)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  dup_ids integer;
  dup_rows integer;
BEGIN
  SELECT count(*), coalesce(sum(n), 0) INTO dup_ids, dup_rows
  FROM (
    SELECT "externalId", count(*) AS n
    FROM "Order"
    WHERE "externalId" IS NOT NULL
    GROUP BY "externalId"
    HAVING count(*) > 1
  ) d;
  IF dup_ids > 0 THEN
    RAISE EXCEPTION
      'Order.externalId has % duplicated value(s) across % orders. Resolve them before deploying (docs/erp/MIGRATIONS.md, "externalId duplicates"). Nothing was changed.',
      dup_ids, dup_rows;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "Order_externalId_key" ON "Order"("externalId");

