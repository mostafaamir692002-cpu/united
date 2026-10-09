-- CreateTable
CREATE TABLE "StockIssueException" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "documentId" TEXT,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "requestedQty" DECIMAL(18,3) NOT NULL,
    "issuedQty" DECIMAL(18,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockIssueException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockIssueException_status_createdAt_idx" ON "StockIssueException"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StockIssueException_orderId_idx" ON "StockIssueException"("orderId");

-- AddForeignKey
ALTER TABLE "StockIssueException" ADD CONSTRAINT "StockIssueException_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIssueException" ADD CONSTRAINT "StockIssueException_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InventoryDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity: the shape of an exception is fixed, whatever writes it.
ALTER TABLE "StockIssueException" ADD CONSTRAINT "StockIssueException_reason_known" CHECK ("reason" IN ('unmapped', 'unit_mismatch', 'insufficient'));
ALTER TABLE "StockIssueException" ADD CONSTRAINT "StockIssueException_status_known" CHECK ("status" IN ('open', 'resolved', 'voided'));
ALTER TABLE "StockIssueException" ADD CONSTRAINT "StockIssueException_quantities" CHECK ("requestedQty" > 0 AND "issuedQty" >= 0 AND "issuedQty" < "requestedQty");
ALTER TABLE "StockIssueException" ADD CONSTRAINT "StockIssueException_closed_attributed" CHECK (
  ("status" = 'open' AND "resolvedAt" IS NULL)
  OR ("status" IN ('resolved', 'voided') AND "resolvedAt" IS NOT NULL AND length(btrim(coalesce("resolution", ''))) > 0)
);

-- Same posture as every other table: the app talks to Postgres directly; the
-- Supabase anon/authenticated roles get nothing.
ALTER TABLE "StockIssueException" ENABLE ROW LEVEL SECURITY;
