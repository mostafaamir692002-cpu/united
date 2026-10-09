-- Receipts and payments can settle imported open Odoo items as well as native
-- invoices and bills. Keep exactly one target so every allocation is traceable.
ALTER TABLE "ReceiptAllocation"
  ALTER COLUMN "invoiceId" DROP NOT NULL,
  ADD COLUMN "openingBalanceId" TEXT,
  ADD CONSTRAINT "ReceiptAllocation_one_target"
    CHECK (("invoiceId" IS NOT NULL) <> ("openingBalanceId" IS NOT NULL));

ALTER TABLE "ReceiptAllocation"
  ADD CONSTRAINT "ReceiptAllocation_openingBalanceId_fkey"
  FOREIGN KEY ("openingBalanceId") REFERENCES "PartyOpeningBalance"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ReceiptAllocation_openingBalanceId_idx" ON "ReceiptAllocation"("openingBalanceId");

ALTER TABLE "PaymentAllocation"
  ALTER COLUMN "billId" DROP NOT NULL,
  ADD COLUMN "openingBalanceId" TEXT,
  ADD CONSTRAINT "PaymentAllocation_one_target"
    CHECK (("billId" IS NOT NULL) <> ("openingBalanceId" IS NOT NULL));

ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_openingBalanceId_fkey"
  FOREIGN KEY ("openingBalanceId") REFERENCES "PartyOpeningBalance"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PaymentAllocation_openingBalanceId_idx" ON "PaymentAllocation"("openingBalanceId");
