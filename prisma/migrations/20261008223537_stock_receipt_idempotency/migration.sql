-- Stock receipts: a client key per submitted receiving form, so a retried, timed-out or
-- duplicated request returns the first receipt instead of posting the stock (and GRNI) twice.
-- Additive: one nullable column; existing receipts keep NULL (allowed many times by a unique index).

-- AlterTable
ALTER TABLE "StockIntake" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockIntake_idempotencyKey_key" ON "StockIntake"("idempotencyKey");

