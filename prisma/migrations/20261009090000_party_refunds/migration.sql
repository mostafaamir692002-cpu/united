-- Refunds: money paid back to a customer out of the credit they hold (a return or an
-- overpayment after payment), and money a supplier pays back to us. Additive: two new
-- append-only tables, and two journal source types (a relaxation no existing row can violate).

-- CreateTable
CREATE TABLE "CustomerRefund" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "customerId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierRefund" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "supplierId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_number_key" ON "CustomerRefund"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_idempotencyKey_key" ON "CustomerRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CustomerRefund_customerId_idx" ON "CustomerRefund"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierRefund_number_key" ON "SupplierRefund"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierRefund_idempotencyKey_key" ON "SupplierRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SupplierRefund_supplierId_idx" ON "SupplierRefund"("supplierId");

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRefund" ADD CONSTRAINT "SupplierRefund_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRefund" ADD CONSTRAINT "SupplierRefund_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Permanent money documents, like receipts and payments.
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_values" CHECK ("number" ~ '^RFD-[0-9]{4}-[0-9]{5,}$' AND "amount" > 0 AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "method" IN ('cash', 'bank_transfer', 'cheque', 'wallet', 'other') AND length(btrim("reason")) > 0);
ALTER TABLE "SupplierRefund" ADD CONSTRAINT "SupplierRefund_values" CHECK ("number" ~ '^SRF-[0-9]{4}-[0-9]{5,}$' AND "amount" > 0 AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "method" IN ('cash', 'bank_transfer', 'cheque', 'wallet', 'other') AND length(btrim("reason")) > 0);
CREATE TRIGGER "CustomerRefund_append_only" BEFORE UPDATE OR DELETE ON "CustomerRefund" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE TRIGGER "SupplierRefund_append_only" BEFORE UPDATE OR DELETE ON "SupplierRefund" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
ALTER TABLE "CustomerRefund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierRefund" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_values";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_values" CHECK (
  "number" ~ '^JE-[0-9]{4}-[0-9]{5,}$' AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "total" > 0 AND length(btrim("description")) > 0
  AND "sourceType" IN ('manual', 'sales_invoice', 'credit_note', 'supplier_bill', 'debit_note', 'customer_receipt', 'supplier_payment', 'stock_valuation', 'reversal', 'expense', 'employee_transaction', 'opening_balance', 'receipt_reversal', 'payment_reversal', 'customer_refund', 'supplier_refund')
  AND (("sourceType" = 'reversal') = ("reversalOfId" IS NOT NULL))
);
