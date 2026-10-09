-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "issueDate" TEXT,
    "dueDate" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "buyerName" TEXT,
    "buyerTaxId" TEXT,
    "buyerAddress" TEXT,
    "gross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "voidReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3),

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "orderItemId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCode" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "gross" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "net" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "SalesInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
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

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceLineId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "gross" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "net" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_number_key" ON "SalesInvoice"("number");

-- CreateIndex
CREATE INDEX "SalesInvoice_customerId_status_idx" ON "SalesInvoice"("customerId", "status");

-- CreateIndex
CREATE INDEX "SalesInvoice_status_issueDate_idx" ON "SalesInvoice"("status", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoiceLine_invoiceId_lineNo_key" ON "SalesInvoiceLine"("invoiceId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_number_key" ON "CreditNote"("number");

-- CreateIndex
CREATE INDEX "CreditNote_customerId_idx" ON "CreditNote"("customerId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNoteLine_invoiceLineId_idx" ON "CreditNoteLine"("invoiceLineId");

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "SalesInvoiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_status_known" CHECK ("status" IN ('draft', 'issued', 'void'));
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_number_shape" CHECK ("number" IS NULL OR "number" ~ '^INV-[0-9]{4}-[0-9]{5,}$');
-- Issued ⇔ numbered, dated and attributed; only a draft may be voided (an issued
-- invoice is corrected by credit notes).
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_issued_complete" CHECK (
  ("status" = 'issued') = ("number" IS NOT NULL)
  AND ("status" <> 'issued' OR ("issueDate" IS NOT NULL AND "dueDate" IS NOT NULL AND "issuedAt" IS NOT NULL AND "buyerName" IS NOT NULL AND "dueDate" >= "issueDate"))
);
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_void_has_reason" CHECK ("status" <> 'void' OR length(btrim(coalesce("voidReason", ''))) > 0);
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_totals" CHECK (
  "gross" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0
  AND "net" = "gross" - "discountTotal" AND "total" = "net" + "taxTotal"
);
-- One live invoice per order (a voided draft frees the order to be invoiced again).
CREATE UNIQUE INDEX "SalesInvoice_one_per_order" ON "SalesInvoice"("orderId") WHERE "orderId" IS NOT NULL AND "status" <> 'void';

ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_amounts" CHECK (
  "quantity" > 0 AND "unitPrice" >= 0 AND "discountPct" BETWEEN 0 AND 100 AND "taxRate" BETWEEN 0 AND 100
  AND "net" = "gross" - "discount" AND "total" = "net" + "tax"
);
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_number_shape" CHECK ("number" ~ '^CN-[0-9]{4}-[0-9]{5,}$');
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_reason_not_blank" CHECK (length(btrim("reason")) > 0);
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_totals" CHECK (
  "gross" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0 AND "total" > 0
  AND "net" = "gross" - "discountTotal" AND "total" = "net" + "taxTotal"
);
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_amounts" CHECK ("quantity" > 0 AND "net" = "gross" - "discount" AND "total" = "net" + "tax");

-- ---------------------------------------------------------------------------
-- Immutability, enforced by the database for every writer.
--  * An issued invoice's financial content never changes; its row may only be
--    touched to bump nothing (no UPDATE path is needed after issue).
--  * Lines of an issued invoice cannot be added, changed or removed.
--  * Credit notes and their lines are append-only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sales_invoice_frozen() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'SalesInvoice rows are never deleted (void a draft instead)' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" IN ('issued', 'void') THEN
    RAISE EXCEPTION 'SalesInvoice % is % and cannot change — issue a credit note', coalesce(OLD."number", OLD."id"), OLD."status" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "SalesInvoice_frozen" BEFORE UPDATE OR DELETE ON "SalesInvoice"
FOR EACH ROW EXECUTE FUNCTION sales_invoice_frozen();

CREATE OR REPLACE FUNCTION sales_invoice_line_frozen() RETURNS trigger AS $$
DECLARE st text;
BEGIN
  SELECT "status" INTO st FROM "SalesInvoice" WHERE "id" = coalesce(NEW."invoiceId", OLD."invoiceId");
  IF st IN ('issued', 'void') THEN
    RAISE EXCEPTION 'lines of an % invoice cannot change', st USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "SalesInvoiceLine_frozen" BEFORE INSERT OR UPDATE OR DELETE ON "SalesInvoiceLine"
FOR EACH ROW EXECUTE FUNCTION sales_invoice_line_frozen();

CREATE OR REPLACE FUNCTION sales_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "CreditNote_append_only" BEFORE UPDATE OR DELETE ON "CreditNote"
FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE TRIGGER "CreditNoteLine_append_only" BEFORE UPDATE OR DELETE ON "CreditNoteLine"
FOR EACH ROW EXECUTE FUNCTION sales_append_only();

ALTER TABLE "SalesInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesInvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditNoteLine" ENABLE ROW LEVEL SECURITY;
