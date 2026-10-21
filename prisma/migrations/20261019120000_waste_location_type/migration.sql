-- F-01 / F-20 remediation (authorized 2026-10-19)
-- Classify loc_waste as type 'waste' so that:
--  1. availability (balances) and picking (allocate) can exclude it from sellable
--     stock, reservations, automatic picking and dispatch (F-01);
--  2. the cold-chain inbound guard (NOT_FOR_COLD_CHAIN = {"dry","other"}) no longer
--     blocks cold-chain product waste from being recorded at intake or sorting (F-20).
-- Additive: the location-type whitelist gains 'waste' (no existing value removed).
-- Reversible: re-update the row to 'other' and re-add the constraint without 'waste'.
-- No data loss: movements reference the location id, not its type.

ALTER TABLE "StorageLocation" DROP CONSTRAINT "StorageLocation_type_known";
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_type_known" CHECK ("type" IN
  ('cold_room', 'chiller', 'freezer', 'dry', 'receiving', 'staging', 'dispatch', 'quarantine', 'waste', 'other'));

UPDATE "StorageLocation" SET "type" = 'waste' WHERE "id" = 'loc_waste' AND "type" = 'other';