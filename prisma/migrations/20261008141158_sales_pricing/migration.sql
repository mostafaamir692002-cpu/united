-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "priceListId" TEXT;

-- AlterTable
ALTER TABLE "StockProduct" ADD COLUMN     "salesTaxCode" TEXT NOT NULL DEFAULT 'EXEMPT';

-- CreateTable
CREATE TABLE "TaxRate" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "etaType" TEXT,
    "etaSubtype" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("code")
);

-- Baseline tax classes (stable codes; the same rows are in lib/core/reference-data.ts
-- for the test seed). Existing products default to EXEMPT: unprocessed fresh fruit
-- and vegetables are VAT-exempt in Egypt. ETA classification: T1 / V003 exempt,
-- V009 general sales, V001 export.
INSERT INTO "TaxRate" ("code", "name", "nameAr", "rate", "etaType", "etaSubtype") VALUES
  ('EXEMPT', 'VAT exempt', 'معفى من ضريبة القيمة المضافة', 0, 'T1', 'V003'),
  ('VAT14', 'VAT 14%', 'ضريبة قيمة مضافة 14%', 14, 'T1', 'V009'),
  ('VAT0', 'VAT 0% (export)', 'ضريبة صفرية (تصدير)', 0, 'T1', 'V001');

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "validFrom" TEXT NOT NULL,
    "validTo" TEXT,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemPrice" (
    "orderItemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCode" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "source" TEXT NOT NULL,
    "priceListId" TEXT,
    "priceListItemId" TEXT,
    "reason" TEXT,
    "setById" TEXT,
    "setBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItemPrice_pkey" PRIMARY KEY ("orderItemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_code_key" ON "PriceList"("code");

-- CreateIndex
CREATE INDEX "PriceListItem_productId_validFrom_idx" ON "PriceListItem"("productId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_priceListId_productId_uomCode_validFrom_key" ON "PriceListItem"("priceListId", "productId", "uomCode", "validFrom");

-- AddForeignKey
ALTER TABLE "StockProduct" ADD CONSTRAINT "StockProduct_salesTaxCode_fkey" FOREIGN KEY ("salesTaxCode") REFERENCES "TaxRate"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_uomCode_fkey" FOREIGN KEY ("uomCode") REFERENCES "UnitOfMeasure"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemPrice" ADD CONSTRAINT "OrderItemPrice_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity rules.
-- ---------------------------------------------------------------------------
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_rate_range" CHECK ("rate" >= 0 AND "rate" <= 100);
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_code_shape" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]*$');
CREATE UNIQUE INDEX "PriceList_one_default" ON "PriceList"("isDefault") WHERE "isDefault" AND "active";
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_price_non_negative" CHECK ("unitPrice" >= 0);
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_dates" CHECK (
  "validFrom" ~ '^\d{4}-\d{2}-\d{2}$' AND ("validTo" IS NULL OR ("validTo" ~ '^\d{4}-\d{2}-\d{2}$' AND "validTo" >= "validFrom"))
);
ALTER TABLE "OrderItemPrice" ADD CONSTRAINT "OrderItemPrice_price_non_negative" CHECK ("unitPrice" >= 0);
ALTER TABLE "OrderItemPrice" ADD CONSTRAINT "OrderItemPrice_discount_range" CHECK ("discountPct" >= 0 AND "discountPct" <= 100);
ALTER TABLE "OrderItemPrice" ADD CONSTRAINT "OrderItemPrice_tax_range" CHECK ("taxRate" >= 0 AND "taxRate" <= 100);
ALTER TABLE "OrderItemPrice" ADD CONSTRAINT "OrderItemPrice_source_known" CHECK ("source" IN ('list', 'manual', 'quotation'));
ALTER TABLE "OrderItemPrice" ADD CONSTRAINT "OrderItemPrice_manual_has_reason" CHECK ("source" <> 'manual' OR length(btrim(coalesce("reason", ''))) > 0);
ALTER TABLE "OrderItemPrice" ADD CONSTRAINT "OrderItemPrice_list_has_list" CHECK ("source" <> 'list' OR "priceListItemId" IS NOT NULL);

ALTER TABLE "TaxRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceListItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItemPrice" ENABLE ROW LEVEL SECURITY;
