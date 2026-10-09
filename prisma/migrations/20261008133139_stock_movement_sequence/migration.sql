-- A global posting order for the stock ledger.
--
-- FIFO costing and "what happened first" were ordered by timestamp, and two
-- movements posted in the same millisecond tie — making FIFO nondeterministic.
-- seq is assigned from a sequence at insert, so it is strictly increasing in
-- commit-independent posting order.
--
-- Existing rows are numbered in their historical order (createdAt, then id). That
-- one-time numbering is the only UPDATE ever made to ledger rows: the append-only
-- trigger is suspended for exactly that statement and restored immediately. No
-- quantity, cost or reference changes.
ALTER TABLE "StockMovement" ADD COLUMN "seq" BIGSERIAL NOT NULL;

ALTER TABLE "StockMovement" DISABLE TRIGGER "StockMovement_append_only";
WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn FROM "StockMovement"
)
UPDATE "StockMovement" m SET "seq" = o.rn FROM ordered o WHERE m."id" = o."id";
ALTER TABLE "StockMovement" ENABLE TRIGGER "StockMovement_append_only";

SELECT setval(pg_get_serial_sequence('"StockMovement"', 'seq'), coalesce((SELECT max("seq") FROM "StockMovement"), 0) + 1, false);

CREATE UNIQUE INDEX "StockMovement_seq_key" ON "StockMovement"("seq");
