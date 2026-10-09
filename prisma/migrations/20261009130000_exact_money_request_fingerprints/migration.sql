-- Keep complete request fingerprints for money documents with idempotency keys.
-- Nullable columns preserve replay for historical documents created before this guard.
ALTER TABLE "PartyOpeningBalance" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "CreditNote" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "DebitNote" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "Expense" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "EmployeeTransaction" ADD COLUMN "requestHash" TEXT;
