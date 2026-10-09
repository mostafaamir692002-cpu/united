-- Receipts and payments: a client key per submitted form, so a double tap or a retried
-- request returns the first document instead of recording the money twice.
-- Additive: nullable columns, existing rows keep NULL (allowed many times by a unique index).

-- AlterTable
ALTER TABLE "CustomerReceipt" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipt_idempotencyKey_key" ON "CustomerReceipt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_idempotencyKey_key" ON "SupplierPayment"("idempotencyKey");

