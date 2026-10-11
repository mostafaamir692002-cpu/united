-- Add second-grade (فرزة) and waste (هالك) tracking to stock intake
ALTER TABLE "StockIntake" ADD COLUMN "gradeBQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
ALTER TABLE "StockIntake" ADD COLUMN "wasteQty" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- Add default grading / quarantine locations
INSERT INTO "StorageLocation" ("id", "warehouseId", "code", "name", "nameAr", "type", "active", "version", "createdAt", "updatedAt")
VALUES
  ('loc_grade_b', 'wh_main', 'GRADE-B', 'Second grade / فرزة', 'فرزة', 'cold_room', true, 1, NOW(), NOW()),
  ('loc_waste', 'wh_main', 'WASTE', 'Spoilage / waste', 'هالك وتوالف', 'other', true, 1, NOW(), NOW()),
  ('loc_quarantine', 'wh_main', 'QUAR', 'Quarantine (returns)', 'حجر صحي (مرتجعات)', 'quarantine', true, 1, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;