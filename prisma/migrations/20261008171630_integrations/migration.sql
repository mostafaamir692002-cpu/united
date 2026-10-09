-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT,
    "caller" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "externalId" TEXT,
    "result" TEXT,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_code_key" ON "Integration"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_keyHash_key" ON "Integration"("keyHash");

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_integrationId_createdAt_idx" ON "IntegrationLog"("integrationId", "createdAt");

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Integration" ADD CONSTRAINT "Integration_values" CHECK ("code" ~ '^[a-z][a-z0-9_-]{1,30}$' AND "scopes" <@ ARRAY['orders.create', 'orders.status']::text[] AND cardinality("scopes") > 0 AND ("active" OR "revokedAt" IS NOT NULL));
-- The log is evidence: append-only.
CREATE TRIGGER "IntegrationLog_append_only" BEFORE UPDATE OR DELETE ON "IntegrationLog" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntegrationLog" ENABLE ROW LEVEL SECURITY;
