-- Receipts and payments can be taken back (bounced cheque, wrong customer) by a reversal
-- document; the originals stay untouched. Additive: two new append-only tables.

-- CreateTable
CREATE TABLE "CustomerReceiptReversal" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReceiptReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPaymentReversal" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentReversal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceiptReversal_receiptId_key" ON "CustomerReceiptReversal"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentReversal_paymentId_key" ON "SupplierPaymentReversal"("paymentId");

-- AddForeignKey
ALTER TABLE "CustomerReceiptReversal" ADD CONSTRAINT "CustomerReceiptReversal_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentReversal" ADD CONSTRAINT "SupplierPaymentReversal_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reversals are permanent documents like the receipts and payments they cancel.
ALTER TABLE "CustomerReceiptReversal" ADD CONSTRAINT "CustomerReceiptReversal_values" CHECK ("date" ~ '^\d{4}-\d{2}-\d{2}$' AND length(btrim("reason")) > 0);
ALTER TABLE "SupplierPaymentReversal" ADD CONSTRAINT "SupplierPaymentReversal_values" CHECK ("date" ~ '^\d{4}-\d{2}-\d{2}$' AND length(btrim("reason")) > 0);
CREATE TRIGGER "CustomerReceiptReversal_append_only" BEFORE UPDATE OR DELETE ON "CustomerReceiptReversal" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE TRIGGER "SupplierPaymentReversal_append_only" BEFORE UPDATE OR DELETE ON "SupplierPaymentReversal" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
ALTER TABLE "CustomerReceiptReversal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierPaymentReversal" ENABLE ROW LEVEL SECURITY;

-- Their journal entries. A relaxation: no existing row can violate it.
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_values";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_values" CHECK (
  "number" ~ '^JE-[0-9]{4}-[0-9]{5,}$' AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "total" > 0 AND length(btrim("description")) > 0
  AND "sourceType" IN ('manual', 'sales_invoice', 'credit_note', 'supplier_bill', 'debit_note', 'customer_receipt', 'supplier_payment', 'stock_valuation', 'reversal', 'expense', 'employee_transaction', 'opening_balance', 'receipt_reversal', 'payment_reversal')
  AND (("sourceType" = 'reversal') = ("reversalOfId" IS NOT NULL))
);
