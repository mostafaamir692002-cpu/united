-- Customer commercial groups (brands) and legal billing entities.
-- A hotel (Customer) keeps its own operational identity and may link to:
--   * many CustomerGroup rows (searchable brands, purely commercial)
--   * one CustomerLegalEntity (the legal identity that owns the tax number)

-- CreateTable CustomerGroup
CREATE TABLE "CustomerGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex CustomerGroup_code_key
CREATE UNIQUE INDEX "CustomerGroup_code_key" ON "CustomerGroup"("code");

-- CreateIndex CustomerGroup_active_name_idx
CREATE INDEX "CustomerGroup_active_name_idx" ON "CustomerGroup"("active", "name");

-- CreateTable CustomerGroupMember
CREATE TABLE "CustomerGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex CustomerGroupMember_groupId_customerId_key
CREATE UNIQUE INDEX "CustomerGroupMember_groupId_customerId_key" ON "CustomerGroupMember"("groupId", "customerId");

-- CreateIndex CustomerGroupMember_customerId_idx
CREATE INDEX "CustomerGroupMember_customerId_idx" ON "CustomerGroupMember"("customerId");

-- CreateTable CustomerLegalEntity
CREATE TABLE "CustomerLegalEntity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "taxRegistrationNo" TEXT,
    "commercialRegNo" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "area" TEXT,
    "city" TEXT,
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
    "receiverType" TEXT,
    "receiverId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerLegalEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex CustomerLegalEntity_code_key
CREATE UNIQUE INDEX "CustomerLegalEntity_code_key" ON "CustomerLegalEntity"("code");

-- CreateIndex CustomerLegalEntity_taxRegistrationNo_key
CREATE UNIQUE INDEX "CustomerLegalEntity_taxRegistrationNo_key" ON "CustomerLegalEntity"("taxRegistrationNo");

-- CreateIndex CustomerLegalEntity_active_name_idx
CREATE INDEX "CustomerLegalEntity_active_name_idx" ON "CustomerLegalEntity"("active", "name");

-- AlterTable Customer: link to the legal billing entity (nullable — a hotel may
-- bill under its own identity or have no known legal data yet).
ALTER TABLE "Customer" ADD COLUMN "legalEntityId" TEXT;

-- CreateIndex Customer_legalEntityId_idx
CREATE INDEX "Customer_legalEntityId_idx" ON "Customer"("legalEntityId");

-- AddForeignKey Customer_legalEntityId_fkey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "CustomerLegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey CustomerGroupMember_groupId_fkey
ALTER TABLE "CustomerGroupMember" ADD CONSTRAINT "CustomerGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey CustomerGroupMember_customerId_fkey
ALTER TABLE "CustomerGroupMember" ADD CONSTRAINT "CustomerGroupMember_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;