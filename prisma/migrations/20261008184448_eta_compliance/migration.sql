-- ETA e-invoicing compliance layer: new tables only. No existing table or row is changed.
-- See docs/erp/ETA_EINVOICE.md.

-- CreateTable
CREATE TABLE "EtaIssuerProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "etaBranchId" TEXT,
    "activityCode" TEXT,
    "country" TEXT,
    "governate" TEXT,
    "regionCity" TEXT,
    "street" TEXT,
    "buildingNumber" TEXT,
    "postalCode" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "landmark" TEXT,
    "additionalInformation" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtaIssuerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtaReceiverProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "receiverType" TEXT,
    "receiverId" TEXT,
    "country" TEXT,
    "governate" TEXT,
    "regionCity" TEXT,
    "street" TEXT,
    "buildingNumber" TEXT,
    "postalCode" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "landmark" TEXT,
    "additionalInformation" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtaReceiverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtaItemCode" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtaItemCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtaUnitType" (
    "uomCode" TEXT NOT NULL,
    "etaUnitType" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtaUnitType_pkey" PRIMARY KEY ("uomCode")
);

-- CreateTable
CREATE TABLE "EtaDocument" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentTypeVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submissionId" TEXT,
    "uuid" TEXT,
    "longId" TEXT,
    "hashKey" TEXT,
    "payloadHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" JSONB,
    "lastResponse" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtaDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtaDocumentEvent" (
    "id" TEXT NOT NULL,
    "etaDocumentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "detail" JSONB,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EtaDocumentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtaIssuerProfile_companyId_key" ON "EtaIssuerProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EtaReceiverProfile_customerId_key" ON "EtaReceiverProfile"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "EtaItemCode_productId_key" ON "EtaItemCode"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "EtaDocument_uuid_key" ON "EtaDocument"("uuid");

-- CreateIndex
CREATE INDEX "EtaDocument_status_idx" ON "EtaDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EtaDocument_sourceType_sourceId_key" ON "EtaDocument"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "EtaDocumentEvent_etaDocumentId_createdAt_idx" ON "EtaDocumentEvent"("etaDocumentId", "createdAt");

-- AddForeignKey
ALTER TABLE "EtaIssuerProfile" ADD CONSTRAINT "EtaIssuerProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtaReceiverProfile" ADD CONSTRAINT "EtaReceiverProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtaItemCode" ADD CONSTRAINT "EtaItemCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtaUnitType" ADD CONSTRAINT "EtaUnitType_uomCode_fkey" FOREIGN KEY ("uomCode") REFERENCES "UnitOfMeasure"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtaDocumentEvent" ADD CONSTRAINT "EtaDocumentEvent_etaDocumentId_fkey" FOREIGN KEY ("etaDocumentId") REFERENCES "EtaDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Closed value sets.
ALTER TABLE "EtaReceiverProfile" ADD CONSTRAINT "EtaReceiverProfile_values" CHECK ("receiverType" IS NULL OR "receiverType" IN ('B', 'P', 'F'));
ALTER TABLE "EtaItemCode" ADD CONSTRAINT "EtaItemCode_values" CHECK ("itemType" IN ('GS1', 'EGS') AND length(btrim("itemCode")) > 0);
ALTER TABLE "EtaUnitType" ADD CONSTRAINT "EtaUnitType_values" CHECK (length(btrim("etaUnitType")) > 0);
ALTER TABLE "EtaDocument" ADD CONSTRAINT "EtaDocument_values" CHECK (
  "sourceType" IN ('sales_invoice', 'credit_note', 'debit_note')
  AND "documentType" IN ('i', 'c', 'd')
  AND "status" IN ('pending', 'submitting', 'submitted', 'valid', 'invalid', 'rejected', 'failed', 'unknown', 'cancelled')
  AND "attempts" >= 0
);

-- The ETA state of a document is never deleted: deleting it would let the same UNITED
-- invoice be submitted to ETA a second time. Its history is append-only.
CREATE OR REPLACE FUNCTION eta_document_no_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ETA document state is permanent (%)', OLD."internalId" USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "EtaDocument_no_delete" BEFORE DELETE ON "EtaDocument" FOR EACH ROW EXECUTE FUNCTION eta_document_no_delete();
CREATE TRIGGER "EtaDocumentEvent_append_only" BEFORE UPDATE OR DELETE ON "EtaDocumentEvent" FOR EACH ROW EXECUTE FUNCTION sales_append_only();

ALTER TABLE "EtaIssuerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EtaReceiverProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EtaItemCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EtaUnitType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EtaDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EtaDocumentEvent" ENABLE ROW LEVEL SECURITY;
