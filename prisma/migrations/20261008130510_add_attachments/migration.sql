-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletedBy" TEXT,
    "deleteReason" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_sha256_idx" ON "Attachment"("sha256");


-- The same file is stored once per record (re-uploads and racing uploads coalesce).
CREATE UNIQUE INDEX "Attachment_unique_content_per_record"
  ON "Attachment" ("entityType", "entityId", "sha256") WHERE "deletedAt" IS NULL;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_category_known" CHECK ("category" IN
  ('contract', 'invoice', 'delivery_note', 'purchase_document', 'quality_photo', 'receipt', 'tax_document', 'other'));
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_size_positive" CHECK ("sizeBytes" > 0);
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_sha256_hex" CHECK ("sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_provider_known" CHECK ("storageProvider" IN ('supabase', 'local'));
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fileName_not_blank" CHECK (length(btrim("fileName")) > 0);
-- A deleted attachment always says who deleted it and why.
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_deletion_attributed" CHECK (
  "deletedAt" IS NULL OR (length(btrim(coalesce("deletedBy", ''))) > 0 AND length(btrim(coalesce("deleteReason", ''))) > 0)
);
ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
