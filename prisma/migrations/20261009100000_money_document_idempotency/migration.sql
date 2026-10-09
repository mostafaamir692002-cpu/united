-- Credit notes, debit notes, opening balances, expenses and employee transactions are
-- created at most once per client key: a retry after a timeout returns the first
-- document instead of posting twice. Additive: a nullable column and a unique index each;
-- existing rows keep NULL (unique ignores NULLs), so no existing data can conflict.

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "DebitNote" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "EmployeeTransaction" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "PartyOpeningBalance" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_idempotencyKey_key" ON "CreditNote"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DebitNote_idempotencyKey_key" ON "DebitNote"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTransaction_idempotencyKey_key" ON "EmployeeTransaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_idempotencyKey_key" ON "Expense"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PartyOpeningBalance_idempotencyKey_key" ON "PartyOpeningBalance"("idempotencyKey");

