-- CreateTable
CREATE TABLE "SupplierBill" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "supplierId" TEXT NOT NULL,
    "supplierInvoiceNo" TEXT NOT NULL,
    "billDate" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "gross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expectedNet" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "variance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "matchStatus" TEXT NOT NULL DEFAULT 'matched',
    "notes" TEXT,
    "cancelReason" TEXT,
    "approvedById" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "postedBy" TEXT,
    "postedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "intakeId" TEXT NOT NULL,
    "poLineId" TEXT,
    "productId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "receivedQty" DECIMAL(18,3) NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "expectedUnitPrice" DECIMAL(18,4),
    "expectedNet" DECIMAL(18,2),
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCode" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "gross" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "net" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SupplierBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "issueDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "returnDocumentId" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "gross" DECIMAL(18,2) NOT NULL,
    "discountTotal" DECIMAL(18,2) NOT NULL,
    "net" DECIMAL(18,2) NOT NULL,
    "taxTotal" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNoteLine" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "billLineId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "gross" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "net" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "DebitNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierBill_number_key" ON "SupplierBill"("number");

-- CreateIndex
CREATE INDEX "SupplierBill_supplierId_status_idx" ON "SupplierBill"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierBill_status_dueDate_idx" ON "SupplierBill"("status", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierBillLine_intakeId_idx" ON "SupplierBillLine"("intakeId");

-- CreateIndex
CREATE INDEX "SupplierBillLine_poLineId_idx" ON "SupplierBillLine"("poLineId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierBillLine_billId_lineNo_key" ON "SupplierBillLine"("billId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "DebitNote_number_key" ON "DebitNote"("number");

-- CreateIndex
CREATE INDEX "DebitNote_supplierId_idx" ON "DebitNote"("supplierId");

-- CreateIndex
CREATE INDEX "DebitNote_billId_idx" ON "DebitNote"("billId");

-- CreateIndex
CREATE INDEX "DebitNoteLine_billLineId_idx" ON "DebitNoteLine"("billLineId");

-- AddForeignKey
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillLine" ADD CONSTRAINT "SupplierBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillLine" ADD CONSTRAINT "SupplierBillLine_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "StockIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillLine" ADD CONSTRAINT "SupplierBillLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillLine" ADD CONSTRAINT "SupplierBillLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "DebitNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_billLineId_fkey" FOREIGN KEY ("billLineId") REFERENCES "SupplierBillLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity (hand-written; Prisma does not model these)
-- ---------------------------------------------------------------------------
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_status_known" CHECK ("status" IN ('draft', 'pending_approval', 'posted', 'cancelled'));
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_number_shape" CHECK ("number" ~ '^BILL-[0-9]{4}-[0-9]{5,}$');
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_match_known" CHECK ("matchStatus" IN ('matched', 'within_tolerance', 'variance', 'unpriced'));
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_invoice_no_not_blank" CHECK (length(btrim("supplierInvoiceNo")) > 0);
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_dates" CHECK (
  "billDate" ~ '^\d{4}-\d{2}-\d{2}$' AND "dueDate" ~ '^\d{4}-\d{2}-\d{2}$' AND "dueDate" >= "billDate"
);
-- Posted ⇔ attributed and timed; cancelled ⇒ a reason.
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_posted_complete" CHECK (("status" = 'posted') = ("postedAt" IS NOT NULL AND "postedBy" IS NOT NULL));
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_cancel_has_reason" CHECK ("status" <> 'cancelled' OR length(btrim(coalesce("cancelReason", ''))) > 0);
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_totals" CHECK (
  "gross" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0 AND "expectedNet" >= 0
  AND "net" = "gross" - "discountTotal" AND "total" = "net" + "taxTotal"
);
-- The same supplier invoice cannot be booked twice (case and spacing ignored).
CREATE UNIQUE INDEX "SupplierBill_supplier_invoice_once" ON "SupplierBill"("supplierId", lower(btrim("supplierInvoiceNo"))) WHERE "status" <> 'cancelled';

ALTER TABLE "SupplierBillLine" ADD CONSTRAINT "SupplierBillLine_amounts" CHECK (
  "quantity" > 0 AND "receivedQty" >= 0 AND "unitPrice" >= 0 AND ("expectedUnitPrice" IS NULL OR "expectedUnitPrice" >= 0)
  AND "discountPct" BETWEEN 0 AND 100 AND "taxRate" BETWEEN 0 AND 100
  AND "net" = "gross" - "discount" AND "total" = "net" + "tax"
);
-- A receipt is on at most one live bill (a cancelled bill releases its receipts).
CREATE UNIQUE INDEX "SupplierBillLine_one_live_bill_per_receipt" ON "SupplierBillLine"("intakeId") WHERE NOT "released";

ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_number_shape" CHECK ("number" ~ '^DN-[0-9]{4}-[0-9]{5,}$');
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_reason_not_blank" CHECK (length(btrim("reason")) > 0);
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_totals" CHECK (
  "gross" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0 AND "total" > 0
  AND "net" = "gross" - "discountTotal" AND "total" = "net" + "taxTotal"
);
ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_amounts" CHECK ("quantity" > 0 AND "net" = "gross" - "discount" AND "total" = "net" + "tax");

-- ---------------------------------------------------------------------------
-- Immutability, enforced by the database for every writer.
--  * A posted or cancelled bill never changes; bills are never deleted.
--  * Lines of a posted or cancelled bill cannot be added, changed or removed.
--  * Debit notes and their lines are append-only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purchasing_bill_frozen() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'SupplierBill rows are never deleted (cancel a draft instead)' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" IN ('posted', 'cancelled') THEN
    RAISE EXCEPTION 'SupplierBill % is % and cannot change — issue a debit note', OLD."number", OLD."status" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "SupplierBill_frozen" BEFORE UPDATE OR DELETE ON "SupplierBill"
FOR EACH ROW EXECUTE FUNCTION purchasing_bill_frozen();

CREATE OR REPLACE FUNCTION purchasing_bill_line_frozen() RETURNS trigger AS $$
DECLARE st text;
BEGIN
  SELECT "status" INTO st FROM "SupplierBill" WHERE "id" = coalesce(NEW."billId", OLD."billId");
  IF st IN ('posted', 'cancelled') THEN
    RAISE EXCEPTION 'lines of a % bill cannot change', st USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "SupplierBillLine_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "SupplierBillLine"
FOR EACH ROW EXECUTE FUNCTION purchasing_bill_line_frozen();

CREATE TRIGGER "DebitNote_append_only" BEFORE UPDATE OR DELETE ON "DebitNote"
FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE TRIGGER "DebitNoteLine_append_only" BEFORE UPDATE OR DELETE ON "DebitNoteLine"
FOR EACH ROW EXECUTE FUNCTION sales_append_only();

ALTER TABLE "SupplierBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierBillLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebitNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DebitNoteLine" ENABLE ROW LEVEL SECURITY;
