-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "jobTitle" TEXT,
    "phone" TEXT,
    "userId" TEXT,
    "hireDate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "employeeId" TEXT,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "cashAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTransaction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_number_key" ON "Expense"("number");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "Expense_employeeId_idx" ON "Expense"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeTransaction_employeeId_idx" ON "EmployeeTransaction"("employeeId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransaction" ADD CONSTRAINT "EmployeeTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity (hand-written)
-- ---------------------------------------------------------------------------
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_values" CHECK ("code" ~ '^EMP-[0-9]{5,}$' AND length(btrim("name")) > 0);
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_values" CHECK (
  "number" ~ '^EXP-[0-9]{4}-[0-9]{5,}$' AND "amount" > 0 AND length(btrim("description")) > 0 AND "date" ~ '^\d{4}-\d{2}-\d{2}$'
  AND "paymentMode" IN ('cash', 'reimburse', 'advance') AND "status" IN ('pending_approval', 'approved', 'rejected')
  AND ("paymentMode" <> 'cash' OR "cashAccountId" IS NOT NULL)
  AND ("paymentMode" = 'cash' OR "employeeId" IS NOT NULL)
);
ALTER TABLE "EmployeeTransaction" ADD CONSTRAINT "EmployeeTransaction_values" CHECK ("type" IN ('advance', 'reimbursement', 'advance_return') AND "amount" > 0 AND "date" ~ '^\d{4}-\d{2}-\d{2}$');
CREATE TRIGGER "EmployeeTransaction_append_only" BEFORE UPDATE OR DELETE ON "EmployeeTransaction" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
-- Employees are a third subledger on the journal (advances and amounts owed to them).
ALTER TABLE "JournalLine" DROP CONSTRAINT "JournalLine_one_side";
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_one_side" CHECK ("debit" >= 0 AND "credit" >= 0 AND ("debit" = 0) <> ("credit" = 0) AND ("partyType" IS NULL OR "partyType" IN ('customer', 'supplier', 'employee')) AND (("partyType" IS NULL) = ("partyId" IS NULL)));
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_values";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_values" CHECK (
  "number" ~ '^JE-[0-9]{4}-[0-9]{5,}$' AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "total" > 0 AND length(btrim("description")) > 0
  AND "sourceType" IN ('manual', 'sales_invoice', 'credit_note', 'supplier_bill', 'debit_note', 'customer_receipt', 'supplier_payment', 'stock_valuation', 'reversal', 'expense', 'employee_transaction')
  AND (("sourceType" = 'reversal') = ("reversalOfId" IS NOT NULL))
);
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeTransaction" ENABLE ROW LEVEL SECURITY;
