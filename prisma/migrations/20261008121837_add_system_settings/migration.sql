-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- Integrity: a setting key is a dotted lower-case identifier, the version moves
-- forward from 1, and a change is always attributed to someone.
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_key_format"
  CHECK ("key" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$');
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_version_positive" CHECK ("version" >= 1);
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedBy_not_blank" CHECK (length(btrim("updatedBy")) > 0);

-- Same posture as every other table: RLS on, no policies. Prisma connects with
-- BYPASSRLS; the Supabase anon/PostgREST API cannot read or write settings.
ALTER TABLE "SystemSetting" ENABLE ROW LEVEL SECURITY;
