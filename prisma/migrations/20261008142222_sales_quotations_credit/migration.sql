-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "creditNote" TEXT,
ADD COLUMN     "creditStatus" TEXT;

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "validUntil" TEXT NOT NULL,
    "deliveryDate" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "notes" TEXT,
    "decisionNote" TEXT,
    "orderId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCode" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "priceSource" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_number_key" ON "Quotation"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_orderId_key" ON "Quotation"("orderId");

-- CreateIndex
CREATE INDEX "Quotation_customerId_status_idx" ON "Quotation"("customerId", "status");

-- CreateIndex
CREATE INDEX "Quotation_status_validUntil_idx" ON "Quotation"("status", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationLine_quotationId_lineNo_key" ON "QuotationLine"("quotationId", "lineNo");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Order" ADD CONSTRAINT "Order_creditStatus_known" CHECK ("creditStatus" IS NULL OR "creditStatus" IN ('not_applicable', 'ok', 'warning', 'pending_approval', 'approved', 'rejected'));
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_status_known" CHECK ("status" IN ('draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled'));
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_number_shape" CHECK ("number" ~ '^QUO-[0-9]{4}-[0-9]{5,}$');
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_dates" CHECK ("validUntil" ~ '^\d{4}-\d{2}-\d{2}$' AND ("deliveryDate" IS NULL OR "deliveryDate" ~ '^\d{4}-\d{2}-\d{2}$'));
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_converted_has_order" CHECK (("status" = 'converted') = ("orderId" IS NOT NULL));
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_price_non_negative" CHECK ("unitPrice" >= 0);
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_discount_range" CHECK ("discountPct" >= 0 AND "discountPct" <= 100);
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_tax_range" CHECK ("taxRate" >= 0 AND "taxRate" <= 100);
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_source_known" CHECK ("priceSource" IN ('list', 'manual'));

ALTER TABLE "Quotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuotationLine" ENABLE ROW LEVEL SECURITY;
