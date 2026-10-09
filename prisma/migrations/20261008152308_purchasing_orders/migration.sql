-- AlterTable
ALTER TABLE "StockIntake" ADD COLUMN     "purchaseOrderLineId" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "neededBy" TEXT,
    "warehouseId" TEXT NOT NULL,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqLine" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RfqLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqSupplier" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "quotedAt" TIMESTAMP(3),
    "validUntil" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RfqSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuoteLine" (
    "id" TEXT NOT NULL,
    "rfqSupplierId" TEXT NOT NULL,
    "rfqLineId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "quantity" DECIMAL(18,3),
    "leadTimeDays" INTEGER,
    "awarded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SupplierQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "rfqId" TEXT,
    "orderDate" TEXT NOT NULL,
    "expectedDate" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'EGP',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "net" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancelReason" TEXT,
    "approvedById" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "uomCode" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "baseQuantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxCode" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "priceSource" TEXT NOT NULL,
    "supplierPriceId" TEXT,
    "quoteLineId" TEXT,
    "notes" TEXT,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_number_key" ON "Rfq"("number");

-- CreateIndex
CREATE INDEX "Rfq_status_idx" ON "Rfq"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RfqLine_rfqId_lineNo_key" ON "RfqLine"("rfqId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "RfqSupplier_rfqId_supplierId_key" ON "RfqSupplier"("rfqId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuoteLine_rfqSupplierId_rfqLineId_key" ON "SupplierQuoteLine"("rfqSupplierId", "rfqLineId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_status_idx" ON "PurchaseOrder"("supplierId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_expectedDate_idx" ON "PurchaseOrder"("status", "expectedDate");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_productId_idx" ON "PurchaseOrderLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_poId_lineNo_key" ON "PurchaseOrderLine"("poId", "lineNo");

-- CreateIndex
CREATE INDEX "StockIntake_purchaseOrderLineId_idx" ON "StockIntake"("purchaseOrderLineId");

-- AddForeignKey
ALTER TABLE "StockIntake" ADD CONSTRAINT "StockIntake_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuoteLine" ADD CONSTRAINT "SupplierQuoteLine_rfqSupplierId_fkey" FOREIGN KEY ("rfqSupplierId") REFERENCES "RfqSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuoteLine" ADD CONSTRAINT "SupplierQuoteLine_rfqLineId_fkey" FOREIGN KEY ("rfqLineId") REFERENCES "RfqLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_supplierPriceId_fkey" FOREIGN KEY ("supplierPriceId") REFERENCES "SupplierPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity.
-- ---------------------------------------------------------------------------
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_status_known" CHECK ("status" IN ('draft', 'sent', 'awarded', 'cancelled'));
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_number_shape" CHECK ("number" ~ '^RFQ-[0-9]{4}-[0-9]{5,}$');
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_status_known" CHECK ("status" IN ('invited', 'quoted', 'declined'));
ALTER TABLE "SupplierQuoteLine" ADD CONSTRAINT "SupplierQuoteLine_values" CHECK ("unitPrice" >= 0 AND ("quantity" IS NULL OR "quantity" > 0) AND ("leadTimeDays" IS NULL OR "leadTimeDays" >= 0));
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_status_known" CHECK ("status" IN ('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled'));
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_number_shape" CHECK ("number" ~ '^PO-[0-9]{4}-[0-9]{5,}$');
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_totals" CHECK ("net" >= 0 AND "taxTotal" >= 0 AND "total" = "net" + "taxTotal");
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_cancel_has_reason" CHECK ("status" <> 'cancelled' OR length(btrim(coalesce("cancelReason", ''))) > 0);
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approved_attributed" CHECK ("status" IN ('draft', 'pending_approval', 'cancelled') OR "approvedAt" IS NOT NULL);
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_values" CHECK (
  "quantity" > 0 AND "baseQuantity" > 0 AND "unitPrice" >= 0 AND "discountPct" BETWEEN 0 AND 100 AND "taxRate" BETWEEN 0 AND 100
);
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_source_known" CHECK ("priceSource" IN ('supplier_price', 'quotation', 'manual'));

ALTER TABLE "Rfq" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RfqLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RfqSupplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierQuoteLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderLine" ENABLE ROW LEVEL SECURITY;
