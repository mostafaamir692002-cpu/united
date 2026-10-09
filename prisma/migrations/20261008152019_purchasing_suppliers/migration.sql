-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "commercialRegNo" TEXT,
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxRegistrationNo" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'other';

-- Existing suppliers are numbered in the order they were created, and the numbering
-- service continues after them. Nothing else about an existing supplier changes.
UPDATE "Supplier" s SET "code" = 'SUP-' || lpad(n::text, 5, '0')
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n FROM "Supplier") o
WHERE o."id" = s."id";
INSERT INTO "NumberSequenceCounter" ("sequenceKey", "period", "lastValue", "updatedAt")
SELECT 'purchasing.supplier', 'all', count(*), CURRENT_TIMESTAMP FROM "Supplier" HAVING count(*) > 0
ON CONFLICT ("sequenceKey", "period") DO UPDATE SET "lastValue" = GREATEST("NumberSequenceCounter"."lastValue", EXCLUDED."lastValue");
ALTER TABLE "Supplier" ALTER COLUMN "code" SET NOT NULL;

-- CreateTable
CREATE TABLE "SupplierContact" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPrice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "validFrom" TEXT NOT NULL,
    "validTo" TEXT,
    "minQty" DECIMAL(18,3),
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierContact_supplierId_idx" ON "SupplierContact"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPrice_productId_validFrom_idx" ON "SupplierPrice"("productId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPrice_supplierId_productId_uomCode_validFrom_key" ON "SupplierPrice"("supplierId", "productId", "uomCode", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_taxRegistrationNo_key" ON "Supplier"("taxRegistrationNo");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPrice" ADD CONSTRAINT "SupplierPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPrice" ADD CONSTRAINT "SupplierPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPrice" ADD CONSTRAINT "SupplierPrice_uomCode_fkey" FOREIGN KEY ("uomCode") REFERENCES "UnitOfMeasure"("code") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity.
-- ---------------------------------------------------------------------------
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_code_shape" CHECK ("code" ~ '^SUP-[0-9]{5,}$');
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_type_known" CHECK ("type" IN ('farm', 'grower', 'wholesaler', 'market_trader', 'importer', 'packaging', 'services', 'other'));
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tax_id_shape" CHECK ("taxRegistrationNo" IS NULL OR "taxRegistrationNo" ~ '^[0-9]{9}$');
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_terms_range" CHECK ("paymentTermsDays" BETWEEN 0 AND 365 AND ("leadTimeDays" IS NULL OR "leadTimeDays" BETWEEN 0 AND 365));
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_name_not_blank" CHECK (length(btrim("name")) > 0);
CREATE UNIQUE INDEX "SupplierContact_one_primary" ON "SupplierContact"("supplierId") WHERE "isPrimary" AND "active";
ALTER TABLE "SupplierPrice" ADD CONSTRAINT "SupplierPrice_values" CHECK ("unitPrice" >= 0 AND ("minQty" IS NULL OR "minQty" > 0) AND ("leadTimeDays" IS NULL OR "leadTimeDays" >= 0));
ALTER TABLE "SupplierPrice" ADD CONSTRAINT "SupplierPrice_dates" CHECK (
  "validFrom" ~ '^\d{4}-\d{2}-\d{2}$' AND ("validTo" IS NULL OR ("validTo" ~ '^\d{4}-\d{2}-\d{2}$' AND "validTo" >= "validFrom"))
);

-- Role PURCHASER and permission group "purchasing". Additive: nobody's role changes.
ALTER TABLE "User" DROP CONSTRAINT "User_role_known";
ALTER TABLE "User" ADD CONSTRAINT "User_role_known"
  CHECK ("role" IN ('SUPER_ADMIN', 'SUPERVISOR', 'STOCK_CONTROLLER', 'PREPARER', 'LOADER', 'SALES', 'ACCOUNTANT', 'PURCHASER'));
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_role_known";
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_known"
  CHECK ("role" IN ('SUPER_ADMIN', 'SUPERVISOR', 'STOCK_CONTROLLER', 'PREPARER', 'LOADER', 'SALES', 'ACCOUNTANT', 'PURCHASER'));
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_group_known";
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_group_known"
  CHECK ("group" IN ('orders', 'stock', 'reports', 'audit', 'users', 'settings', 'core', 'sales', 'purchasing'));

ALTER TABLE "SupplierContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierPrice" ENABLE ROW LEVEL SECURITY;
