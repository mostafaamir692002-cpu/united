/**
 * Syncs the permission catalogue and role bundles from lib/permissions.ts into the
 * database. Idempotent — safe to run on every deploy, and the only writer of
 * Permission/RolePermission. Creates no business data.
 */
import { syncPermissionCatalogue } from "../lib/authz-core";
import { prisma } from "../lib/prisma";

syncPermissionCatalogue()
  .then(async (r) => {
    const [permissions, bundles] = await Promise.all([
      prisma.permission.count(),
      prisma.rolePermission.count(),
    ]);
    console.log(
      `Permission catalogue synced: ${r.permissions} permissions defined, ${permissions} stored, ${bundles} role-permission rows across ${r.roles} roles.`
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
