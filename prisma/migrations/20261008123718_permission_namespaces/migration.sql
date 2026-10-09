-- ---------------------------------------------------------------------------
-- ERP permission namespaces.
--
-- The original catalogue used two-segment keys ("orders.view"). ERP modules use
-- namespaced keys ("core.masterdata.view", later "sales.orders.confirm"), so the key
-- shape now admits two or more lower-case segments. The group stays the first
-- segment (Permission_group_matches_key is unchanged), and the list of known groups
-- grows by exactly the groups the code defines — "core" here; each later module adds
-- its own in its own migration.
-- ---------------------------------------------------------------------------
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_key_shape";
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_key_shape"
  CHECK ("key" ~ '^[a-z]+(\.[a-z_]+)+$');

ALTER TABLE "Permission" DROP CONSTRAINT "Permission_group_known";
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_group_known"
  CHECK ("group" IN ('orders', 'stock', 'reports', 'audit', 'users', 'settings', 'core'));
