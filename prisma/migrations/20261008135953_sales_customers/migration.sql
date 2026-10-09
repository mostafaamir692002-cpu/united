-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerAccountId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "taxRegistrationNo" TEXT,
    "commercialRegNo" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "area" TEXT,
    "address" TEXT,
    "deliveryNotes" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(18,2),
    "creditHold" BOOLEAN NOT NULL DEFAULT false,
    "creditHoldReason" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "externalRef" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAlias" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_taxRegistrationNo_key" ON "Customer"("taxRegistrationNo");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalRef_key" ON "Customer"("externalRef");

-- CreateIndex
CREATE INDEX "Customer_active_name_idx" ON "Customer"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAlias_normalized_key" ON "CustomerAlias"("normalized");

-- CreateIndex
CREATE INDEX "CustomerAlias_customerId_idx" ON "CustomerAlias"("customerId");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");

-- CreateIndex
CREATE INDEX "Order_customerAccountId_idx" ON "Order"("customerAccountId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAlias" ADD CONSTRAINT "CustomerAlias_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity rules for the customer master.
-- ---------------------------------------------------------------------------
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_code_shape" CHECK ("code" ~ '^CUS-[0-9]{5,}$');
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_type_known" CHECK ("type" IN ('hotel', 'restaurant', 'cafe', 'retail', 'wholesale', 'institution', 'other'));
-- Egyptian tax registration numbers are 9 digits.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tax_id_shape" CHECK ("taxRegistrationNo" IS NULL OR "taxRegistrationNo" ~ '^[0-9]{9}$');
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_terms_range" CHECK ("paymentTermsDays" BETWEEN 0 AND 365);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_credit_limit_non_negative" CHECK ("creditLimit" IS NULL OR "creditLimit" >= 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_hold_has_reason" CHECK (NOT "creditHold" OR length(btrim(coalesce("creditHoldReason", ''))) > 0);
ALTER TABLE "CustomerAlias" ADD CONSTRAINT "CustomerAlias_kind_known" CHECK ("kind" IN ('canonical', 'canonical_ar', 'manual'));
ALTER TABLE "CustomerAlias" ADD CONSTRAINT "CustomerAlias_normalized_not_blank" CHECK (length("normalized") > 0);
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_name_not_blank" CHECK (length(btrim("name")) > 0);
-- At most one primary contact per customer.
CREATE UNIQUE INDEX "CustomerContact_one_primary" ON "CustomerContact"("customerId") WHERE "isPrimary" AND "active";

-- ---------------------------------------------------------------------------
-- Two new roles, SALES and ACCOUNTANT. Additive: no existing user changes role,
-- and the role bundles are written by the permission sync, not here.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" DROP CONSTRAINT "User_role_known";
ALTER TABLE "User" ADD CONSTRAINT "User_role_known"
  CHECK ("role" IN ('SUPER_ADMIN', 'SUPERVISOR', 'STOCK_CONTROLLER', 'PREPARER', 'LOADER', 'SALES', 'ACCOUNTANT'));
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_role_known";
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_known"
  CHECK ("role" IN ('SUPER_ADMIN', 'SUPERVISOR', 'STOCK_CONTROLLER', 'PREPARER', 'LOADER', 'SALES', 'ACCOUNTANT'));

-- Permission group "sales".
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_group_known";
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_group_known"
  CHECK ("group" IN ('orders', 'stock', 'reports', 'audit', 'users', 'settings', 'core', 'sales'));

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerContact" ENABLE ROW LEVEL SECURITY;
