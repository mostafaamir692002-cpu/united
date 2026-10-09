-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockIntake" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receivedDate" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "receivedKg" DOUBLE PRECISION NOT NULL,
    "crateCount" INTEGER,
    "rejectedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goodKg" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "recordedById" TEXT,
    "recordedBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "intakeId" TEXT,
    "reason" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE UNIQUE INDEX "StockProduct_name_key" ON "StockProduct"("name");

-- CreateIndex
CREATE INDEX "StockProduct_active_idx" ON "StockProduct"("active");

-- CreateIndex
CREATE UNIQUE INDEX "StockIntake_receiptNumber_key" ON "StockIntake"("receiptNumber");

-- CreateIndex
CREATE INDEX "StockIntake_receivedDate_idx" ON "StockIntake"("receivedDate");

-- CreateIndex
CREATE INDEX "StockIntake_supplierId_idx" ON "StockIntake"("supplierId");

-- CreateIndex
CREATE INDEX "StockIntake_productId_idx" ON "StockIntake"("productId");

-- CreateIndex
CREATE INDEX "StockIntake_status_idx" ON "StockIntake"("status");

-- CreateIndex
CREATE INDEX "StockMovement_productId_occurredAt_idx" ON "StockMovement"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_effectiveDate_idx" ON "StockMovement"("effectiveDate");

-- CreateIndex
CREATE INDEX "StockMovement_intakeId_idx" ON "StockMovement"("intakeId");

-- CreateIndex
CREATE INDEX "StockMovement_kind_idx" ON "StockMovement"("kind");

-- AddForeignKey
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "StockIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity the application must never be the only thing enforcing.
-- These are the invariants the whole module rests on, so they live in the
-- database as well as in the service layer: a bad row cannot be created by a
-- future code path, a migration script, or a hand-written SQL fix.
-- ---------------------------------------------------------------------------

-- Names are trimmed and non-blank, and unique case-insensitively so "Mango" and
-- "mango" can't become two suppliers/products that silently split the same totals.
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "StockProduct" ADD CONSTRAINT "StockProduct_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "StockProduct" ADD CONSTRAINT "StockProduct_unit_not_blank" CHECK (length(btrim("unit")) > 0);
CREATE UNIQUE INDEX "Supplier_name_lower_key" ON "Supplier" (lower(btrim("name")));
CREATE UNIQUE INDEX "StockProduct_name_lower_key" ON "StockProduct" (lower(btrim("name")));

-- A receipt can't reject more than it received, can't hold negative weights, and
-- its good output must equal received - rejected. The tolerance is there because
-- these are doubles: 12.3 - 4.1 is not bit-exact, and a strict = would reject
-- perfectly valid arithmetic.
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_received_non_negative" CHECK ("receivedKg" >= 0);
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_rejected_non_negative" CHECK ("rejectedKg" >= 0);
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_rejected_within_received" CHECK ("rejectedKg" <= "receivedKg");
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_good_is_derived" CHECK (abs("goodKg" - ("receivedKg" - "rejectedKg")) < 0.0001);
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_crates_non_negative" CHECK ("crateCount" IS NULL OR "crateCount" >= 0);
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_status_known" CHECK ("status" IN ('posted', 'voided'));
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_date_format" CHECK ("receivedDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Ledger rows are journal entries: a known kind, a real (non-zero) quantity, and a
-- business day. A zero-quantity movement would be a no-op that still shows up in
-- the movement history as if something happened.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_kind_known"
  CHECK ("kind" IN ('intake', 'intake_correction', 'intake_void', 'adjustment'));
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_non_zero" CHECK ("quantityKg" <> 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_date_format" CHECK ("effectiveDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
-- Every movement that came from a receipt must say which one; a manual adjustment
-- must not pretend to belong to one, and must carry the reason it was made.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_intake_link_matches_kind" CHECK (
  ("kind" = 'adjustment' AND "intakeId" IS NULL AND length(btrim(coalesce("reason", ''))) > 0)
  OR ("kind" <> 'adjustment' AND "intakeId" IS NOT NULL)
);

-- Same posture as the existing tables: RLS on, no policies. Prisma connects as the
-- `postgres` role (BYPASSRLS), so the app is unaffected, while the anon/PostgREST
-- API cannot read or write stock data.
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockIntake" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
