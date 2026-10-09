-- ---------------------------------------------------------------------------
-- Organisation master data (ERP Phase 1): currencies, company → branch →
-- warehouse → storage location, units of measure. Purely additive; no existing
-- table is touched.
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "symbol" TEXT,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "nameAr" TEXT,
    "taxRegistrationNumber" TEXT,
    "commercialRegistration" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "baseCurrencyCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "address" TEXT,
    "areaM2" DECIMAL(12,2),
    "dailyCapacityKg" DECIMAL(14,3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" TEXT NOT NULL,
    "capacityKg" DECIMAL(14,3),
    "tempMinC" DECIMAL(5,2),
    "tempMaxC" DECIMAL(5,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "category" TEXT NOT NULL,
    "ratioToReference" DECIMAL(18,9),
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "precision" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_active_idx" ON "Company"("active");

-- CreateIndex
CREATE INDEX "Branch_active_idx" ON "Branch"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_branchId_idx" ON "Warehouse"("branchId");

-- CreateIndex
CREATE INDEX "Warehouse_active_idx" ON "Warehouse"("active");

-- CreateIndex
CREATE INDEX "StorageLocation_parentId_idx" ON "StorageLocation"("parentId");

-- CreateIndex
CREATE INDEX "StorageLocation_active_idx" ON "StorageLocation"("active");

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_warehouseId_code_key" ON "StorageLocation"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_code_key" ON "UnitOfMeasure"("code");

-- CreateIndex
CREATE INDEX "UnitOfMeasure_category_idx" ON "UnitOfMeasure"("category");

-- CreateIndex
CREATE INDEX "UnitOfMeasure_active_idx" ON "UnitOfMeasure"("active");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_baseCurrencyCode_fkey" FOREIGN KEY ("baseCurrencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity backed by the database, not only the service layer.
-- ---------------------------------------------------------------------------
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_code_iso" CHECK ("code" ~ '^[A-Z]{3}$');
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_decimalPlaces_range" CHECK ("decimalPlaces" BETWEEN 0 AND 4);
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_version_positive" CHECK ("version" >= 1);

-- Codes appear on documents: upper-case letters, digits, '-' and '_'.
ALTER TABLE "Company" ADD CONSTRAINT "Company_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]*$');
ALTER TABLE "Company" ADD CONSTRAINT "Company_legalName_not_blank" CHECK (length(btrim("legalName")) > 0);
ALTER TABLE "Company" ADD CONSTRAINT "Company_version_positive" CHECK ("version" >= 1);

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]*$');
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_version_positive" CHECK ("version" >= 1);

ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]*$');
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_area_non_negative" CHECK ("areaM2" IS NULL OR "areaM2" >= 0);
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_capacity_non_negative" CHECK ("dailyCapacityKg" IS NULL OR "dailyCapacityKg" >= 0);
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_version_positive" CHECK ("version" >= 1);

ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]*$');
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_type_known" CHECK ("type" IN
  ('cold_room', 'chiller', 'freezer', 'dry', 'receiving', 'staging', 'dispatch', 'quarantine', 'other'));
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_capacity_non_negative" CHECK ("capacityKg" IS NULL OR "capacityKg" >= 0);
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_temp_band" CHECK ("tempMinC" IS NULL OR "tempMaxC" IS NULL OR "tempMinC" <= "tempMaxC");
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_version_positive" CHECK ("version" >= 1);

-- Units: weight/volume/count convert through a positive ratio; package units never
-- carry one (the conversion is per product); a reference unit has ratio exactly 1.
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_code_format" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$');
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_category_known" CHECK ("category" IN ('weight', 'volume', 'count', 'package'));
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_precision_range" CHECK ("precision" BETWEEN 0 AND 6);
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_ratio_matches_category" CHECK (
  ("category" = 'package' AND "ratioToReference" IS NULL AND NOT "isReference")
  OR ("category" <> 'package' AND "ratioToReference" > 0)
);
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_reference_is_one" CHECK (NOT "isReference" OR "ratioToReference" = 1);
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_version_positive" CHECK ("version" >= 1);
-- At most one reference unit per category.
CREATE UNIQUE INDEX "UnitOfMeasure_one_reference_per_category" ON "UnitOfMeasure" ("category") WHERE "isReference";

-- Same posture as every other table: RLS on, no policies.
ALTER TABLE "Currency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StorageLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UnitOfMeasure" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Baseline rows (frozen copy of lib/core/reference-data.ts at the time of this
-- migration). Idempotent. Physical figures are the business's approximations and
-- are meant to be corrected in the admin centre.
-- ---------------------------------------------------------------------------
INSERT INTO "Currency" ("code", "name", "nameAr", "symbol", "decimalPlaces", "updatedAt") VALUES
  ('EGP', 'Egyptian Pound', 'جنيه مصري', 'ج.م', 2, CURRENT_TIMESTAMP),
  ('USD', 'US Dollar', 'دولار أمريكي', '$', 2, CURRENT_TIMESTAMP),
  ('EUR', 'Euro', 'يورو', '€', 2, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "UnitOfMeasure" ("id", "code", "name", "nameAr", "category", "ratioToReference", "isReference", "precision", "updatedAt") VALUES
  ('uom_kg', 'KG', 'Kilogram', 'كيلو', 'weight', 1, true, 3, CURRENT_TIMESTAMP),
  ('uom_g', 'G', 'Gram', 'جرام', 'weight', 0.001, false, 0, CURRENT_TIMESTAMP),
  ('uom_ton', 'TON', 'Tonne', 'طن', 'weight', 1000, false, 3, CURRENT_TIMESTAMP),
  ('uom_l', 'L', 'Litre', 'لتر', 'volume', 1, true, 3, CURRENT_TIMESTAMP),
  ('uom_ml', 'ML', 'Millilitre', 'مللي', 'volume', 0.001, false, 0, CURRENT_TIMESTAMP),
  ('uom_piece', 'PIECE', 'Piece', 'قطعة', 'count', 1, true, 0, CURRENT_TIMESTAMP),
  ('uom_dozen', 'DOZEN', 'Dozen', 'دستة', 'count', 12, false, 0, CURRENT_TIMESTAMP),
  ('uom_crate', 'CRATE', 'Crate', 'برنيكة', 'package', NULL, false, 0, CURRENT_TIMESTAMP),
  ('uom_box', 'BOX', 'Box', 'صندوق', 'package', NULL, false, 0, CURRENT_TIMESTAMP),
  ('uom_carton', 'CARTON', 'Carton', 'كرتونة', 'package', NULL, false, 0, CURRENT_TIMESTAMP),
  ('uom_pallet', 'PALLET', 'Pallet', 'باليتة', 'package', NULL, false, 0, CURRENT_TIMESTAMP),
  ('uom_bunch', 'BUNCH', 'Bunch', 'ربطة', 'package', NULL, false, 0, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "Company" ("id", "code", "legalName", "baseCurrencyCode", "updatedAt") VALUES
  ('cmp_united', 'UNITED', 'UNITED Fresh Food Supply', 'EGP', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "Branch" ("id", "companyId", "code", "name", "nameAr", "updatedAt") VALUES
  ('brn_main', 'cmp_united', 'MAIN', 'Main branch', 'الفرع الرئيسي', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "Warehouse" ("id", "branchId", "code", "name", "nameAr", "areaM2", "dailyCapacityKg", "updatedAt") VALUES
  ('wh_main', 'brn_main', 'WH-MAIN', 'Main warehouse', 'المخزن الرئيسي', 1200, 60000, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "StorageLocation" ("id", "warehouseId", "code", "name", "nameAr", "type", "capacityKg", "updatedAt") VALUES
  ('loc_cold_1', 'wh_main', 'COLD-1', 'Cold room 1', 'غرفة تبريد 1', 'cold_room', 10000, CURRENT_TIMESTAMP),
  ('loc_cold_2', 'wh_main', 'COLD-2', 'Cold room 2', 'غرفة تبريد 2', 'cold_room', 10000, CURRENT_TIMESTAMP),
  ('loc_recv', 'wh_main', 'RECV', 'Receiving bay', 'منطقة الاستلام', 'receiving', NULL, CURRENT_TIMESTAMP),
  ('loc_disp', 'wh_main', 'DISP', 'Dispatch dock', 'منطقة التحميل', 'dispatch', NULL, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
