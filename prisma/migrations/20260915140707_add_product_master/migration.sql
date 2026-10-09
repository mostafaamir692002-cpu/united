-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "stockProductId" TEXT;

-- AlterTable
ALTER TABLE "StockProduct" ADD COLUMN     "category" TEXT,
ADD COLUMN     "nameAr" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "stockTracked" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProductAlias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'manual',
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAlias_normalized_key" ON "ProductAlias"("normalized");

-- CreateIndex
CREATE INDEX "ProductAlias_productId_idx" ON "ProductAlias"("productId");

-- CreateIndex
CREATE INDEX "ProductAlias_kind_idx" ON "ProductAlias"("kind");

-- CreateIndex
CREATE INDEX "OrderItem_stockProductId_idx" ON "OrderItem"("stockProductId");

-- CreateIndex
CREATE UNIQUE INDEX "StockProduct_sku_key" ON "StockProduct"("sku");

-- CreateIndex
CREATE INDEX "StockProduct_category_idx" ON "StockProduct"("category");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_stockProductId_fkey" FOREIGN KEY ("stockProductId") REFERENCES "StockProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Identity integrity.
--
-- The application is not the only thing that must be unable to create an ambiguous
-- or unusable product identity. These are the invariants the resolver depends on.
-- ---------------------------------------------------------------------------

-- Names and codes are non-blank when present. A product called "" or "   " is a data
-- entry accident that would otherwise sit in the master forever.
ALTER TABLE "StockProduct" ADD CONSTRAINT "StockProduct_nameAr_not_blank"
  CHECK ("nameAr" IS NULL OR length(btrim("nameAr")) > 0);
ALTER TABLE "StockProduct" ADD CONSTRAINT "StockProduct_sku_not_blank"
  CHECK ("sku" IS NULL OR length(btrim("sku")) > 0);
ALTER TABLE "StockProduct" ADD CONSTRAINT "StockProduct_category_not_blank"
  CHECK ("category" IS NULL OR length(btrim("category")) > 0);

-- A stock-tracked product MUST have a base unit. Quantities without a unit cannot be
-- added up, and the moment such a product reached the ledger the balance would be
-- meaningless. Untracked products may leave it unset.
ALTER TABLE "StockProduct" ADD CONSTRAINT "StockProduct_tracked_needs_unit"
  CHECK ("stockTracked" = false OR length(btrim("unit")) > 0);

-- Aliases: non-blank, and `normalized` must genuinely be normalized (lower-case, no
-- leading/trailing or doubled spaces). The full rule set lives in
-- lib/productIdentity.ts; this catches anything written by a path that skipped it.
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_alias_not_blank"
  CHECK (length(btrim("alias")) > 0);
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_normalized_shape"
  CHECK ("normalized" = lower("normalized")
         AND "normalized" = btrim("normalized")
         AND length("normalized") > 0
         AND position('  ' in "normalized") = 0);
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_kind_known"
  CHECK ("kind" IN ('canonical', 'canonical_ar', 'manual'));

-- A product may hold at most one system-maintained alias of each canonical kind:
-- exactly one English canonical name and at most one Arabic one. Without this, a
-- rename could leave the old canonical alias behind and quietly keep resolving.
CREATE UNIQUE INDEX "ProductAlias_one_canonical_per_kind"
  ON "ProductAlias" ("productId", "kind")
  WHERE "kind" IN ('canonical', 'canonical_ar');

-- Same posture as every other table in this schema.
ALTER TABLE "ProductAlias" ENABLE ROW LEVEL SECURITY;
