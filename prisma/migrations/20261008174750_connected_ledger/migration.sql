-- CreateTable
CREATE TABLE "StockValuationPosting" (
    "movementId" TEXT NOT NULL,
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockValuationPosting_pkey" PRIMARY KEY ("movementId")
);

-- CreateTable
CREATE TABLE "PartyOpeningBalance" (
    "id" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueDate" TEXT NOT NULL,
    "reference" TEXT,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyOpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockValuationPosting_entryId_idx" ON "StockValuationPosting"("entryId");

-- CreateIndex
CREATE INDEX "PartyOpeningBalance_partyType_partyId_idx" ON "PartyOpeningBalance"("partyType", "partyId");


ALTER TABLE "StockValuationPosting" ADD CONSTRAINT "StockValuationPosting_movement_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE RESTRICT;
ALTER TABLE "StockValuationPosting" ADD CONSTRAINT "StockValuationPosting_entry_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT;
CREATE TRIGGER "StockValuationPosting_append_only" BEFORE UPDATE OR DELETE ON "StockValuationPosting" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
-- Layers already covered by the earlier watermark runs are marked posted, so the new
-- per-movement posting never posts them twice. (Their sourceId was "<cutoff ISO>|<day>".)
INSERT INTO "StockValuationPosting" ("movementId", "entryId")
SELECT v."movementId", NULL FROM "StockValuationLayer" v
WHERE v."createdAt" <= (SELECT max(split_part("sourceId", '|', 1)::timestamptz) FROM "JournalEntry" WHERE "sourceType" = 'stock_valuation' AND "sourceId" LIKE '%|%')
ON CONFLICT DO NOTHING;

ALTER TABLE "PartyOpeningBalance" ADD CONSTRAINT "PartyOpeningBalance_values" CHECK ("partyType" IN ('customer', 'supplier') AND "amount" <> 0 AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "dueDate" >= "date");
CREATE TRIGGER "PartyOpeningBalance_append_only" BEFORE UPDATE OR DELETE ON "PartyOpeningBalance" FOR EACH ROW EXECUTE FUNCTION sales_append_only();

-- Opening-balance equity: the other side of everything brought over at go-live.
INSERT INTO "Account" ("id", "code", "name", "nameAr", "type", "parentId", "postable", "systemKey") VALUES
  ('acc_3300', '3300', 'Opening balance equity', 'أرصدة افتتاحية', 'equity', 'acc_3000', true, 'opening_equity')
ON CONFLICT DO NOTHING;
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_values";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_values" CHECK (
  "number" ~ '^JE-[0-9]{4}-[0-9]{5,}$' AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "total" > 0 AND length(btrim("description")) > 0
  AND "sourceType" IN ('manual', 'sales_invoice', 'credit_note', 'supplier_bill', 'debit_note', 'customer_receipt', 'supplier_payment', 'stock_valuation', 'reversal', 'expense', 'employee_transaction', 'opening_balance')
  AND (("sourceType" = 'reversal') = ("reversalOfId" IS NOT NULL))
);
ALTER TABLE "StockValuationPosting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartyOpeningBalance" ENABLE ROW LEVEL SECURITY;
