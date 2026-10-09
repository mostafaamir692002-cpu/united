-- AlterTable
ALTER TABLE "User" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "reason" TEXT,
    "grantedById" TEXT,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_group_idx" ON "Permission"("group");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permissionId_key" ON "UserPermissionOverride"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity. Authorization data is the last place to rely on the application
-- being the only writer: a bad row here is a security hole, not a display bug.
-- ---------------------------------------------------------------------------

-- Only the five defined roles can exist, on a user or in a role bundle. A typo'd
-- role in RolePermission would otherwise create a bundle nobody can see and nobody
-- is granted — silently wrong rather than loudly wrong.
ALTER TABLE "User" ADD CONSTRAINT "User_role_known"
  CHECK ("role" IN ('SUPER_ADMIN', 'SUPERVISOR', 'STOCK_CONTROLLER', 'PREPARER', 'LOADER'));
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_known"
  CHECK ("role" IN ('SUPER_ADMIN', 'SUPERVISOR', 'STOCK_CONTROLLER', 'PREPARER', 'LOADER'));

-- Permission keys are "group.action", lowercase with underscores — the shape the
-- resolver and the seed both assume.
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_key_shape"
  CHECK ("key" ~ '^[a-z]+\.[a-z_]+$');
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_group_known"
  CHECK ("group" IN ('orders', 'stock', 'reports', 'audit', 'users', 'settings'));
-- The group must match the key's prefix, so a permission can never be filed under a
-- section of the admin UI that has nothing to do with what it actually controls.
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_group_matches_key"
  CHECK (split_part("key", '.', 1) = "group");
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_label_not_blank"
  CHECK (length(btrim("label")) > 0);

-- An override either grants or revokes. Anything else would be read as "not a
-- revoke" by a naive check and quietly widen access.
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_effect_known"
  CHECK ("effect" IN ('grant', 'revoke'));
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_granted_by_not_blank"
  CHECK (length(btrim("grantedBy")) > 0);

-- Same posture as every other table: RLS on, no policies. Prisma connects as the
-- `postgres` role (BYPASSRLS); the anon/PostgREST API cannot read the permission
-- tables at all.
ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPermissionOverride" ENABLE ROW LEVEL SECURITY;
