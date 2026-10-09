-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "postable" BOOLEAN NOT NULL DEFAULT true,
    "systemKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "total" DECIMAL(18,2) NOT NULL,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "partyType" TEXT,
    "partyId" TEXT,
    "description" TEXT,
    "reconciliationId" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReceipt" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "statementDate" TEXT NOT NULL,
    "statementBalance" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Account_systemKey_key" ON "Account"("systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_code_key" ON "AccountingPeriod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversalOfId_key" ON "JournalEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalLine_partyType_partyId_idx" ON "JournalLine"("partyType", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "CashAccount_code_key" ON "CashAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipt_number_key" ON "CustomerReceipt"("number");

-- CreateIndex
CREATE INDEX "CustomerReceipt_customerId_idx" ON "CustomerReceipt"("customerId");

-- CreateIndex
CREATE INDEX "ReceiptAllocation_invoiceId_idx" ON "ReceiptAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_number_key" ON "SupplierPayment"("number");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_billId_idx" ON "PaymentAllocation"("billId");

-- CreateIndex
CREATE INDEX "BankReconciliation_cashAccountId_idx" ON "BankReconciliation"("cashAccountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity (hand-written)
-- ---------------------------------------------------------------------------
ALTER TABLE "Account" ADD CONSTRAINT "Account_values" CHECK ("type" IN ('asset', 'liability', 'equity', 'revenue', 'expense') AND "code" ~ '^[0-9]{3,8}$' AND length(btrim("name")) > 0);
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_values" CHECK ("code" ~ '^\d{4}-\d{2}$' AND "status" IN ('open', 'closed') AND "endDate" >= "startDate" AND ("status" = 'open' OR "closedAt" IS NOT NULL));
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_values" CHECK (
  "number" ~ '^JE-[0-9]{4}-[0-9]{5,}$' AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "total" > 0 AND length(btrim("description")) > 0
  AND "sourceType" IN ('manual', 'sales_invoice', 'credit_note', 'supplier_bill', 'debit_note', 'customer_receipt', 'supplier_payment', 'stock_valuation', 'reversal', 'expense')
  AND (("sourceType" = 'reversal') = ("reversalOfId" IS NOT NULL))
);
-- A business document posts once.
CREATE UNIQUE INDEX "JournalEntry_one_per_source" ON "JournalEntry"("sourceType", "sourceId") WHERE "sourceType" NOT IN ('manual', 'reversal');
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_one_side" CHECK ("debit" >= 0 AND "credit" >= 0 AND ("debit" = 0) <> ("credit" = 0) AND ("partyType" IS NULL OR "partyType" IN ('customer', 'supplier')) AND (("partyType" IS NULL) = ("partyId" IS NULL)));
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_type_known" CHECK ("type" IN ('cash', 'bank'));
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_values" CHECK ("number" ~ '^RCT-[0-9]{4}-[0-9]{5,}$' AND "amount" > 0 AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "method" IN ('cash', 'bank_transfer', 'cheque', 'wallet', 'other'));
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_values" CHECK ("number" ~ '^PAY-[0-9]{4}-[0-9]{5,}$' AND "amount" > 0 AND "date" ~ '^\d{4}-\d{2}-\d{2}$' AND "method" IN ('cash', 'bank_transfer', 'cheque', 'wallet', 'other'));
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_positive" CHECK ("amount" > 0);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_positive" CHECK ("amount" > 0);
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_values" CHECK ("status" IN ('open', 'completed') AND "statementDate" ~ '^\d{4}-\d{2}-\d{2}$' AND ("status" = 'open' OR "completedAt" IS NOT NULL));

-- Journals are permanent: corrections are reversing entries. A line may only gain or
-- lose its bank-reconciliation mark.
CREATE TRIGGER "JournalEntry_append_only" BEFORE UPDATE OR DELETE ON "JournalEntry" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE OR REPLACE FUNCTION accounting_line_guard() RETURNS trigger AS $$
DECLARE acc record;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'JournalLine is append-only' USING ERRCODE = 'restrict_violation'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW."entryId", NEW."accountId", NEW."debit", NEW."credit", NEW."partyType", NEW."partyId", NEW."description") IS DISTINCT FROM (OLD."entryId", OLD."accountId", OLD."debit", OLD."credit", OLD."partyType", OLD."partyId", OLD."description") THEN
      RAISE EXCEPTION 'JournalLine is append-only (only the reconciliation mark may change)' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;
  SELECT "postable", "active", "code" INTO acc FROM "Account" WHERE "id" = NEW."accountId";
  IF NOT acc."postable" OR NOT acc."active" THEN
    RAISE EXCEPTION 'account % takes no postings', acc."code" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "JournalLine_guard" BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine" FOR EACH ROW EXECUTE FUNCTION accounting_line_guard();

-- Nothing posts into a closed period.
CREATE OR REPLACE FUNCTION accounting_period_open() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AccountingPeriod" WHERE "status" = 'closed' AND NEW."date" BETWEEN "startDate" AND "endDate") THEN
    RAISE EXCEPTION 'the accounting period of % is closed', NEW."date" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "JournalEntry_period_open" BEFORE INSERT ON "JournalEntry" FOR EACH ROW EXECUTE FUNCTION accounting_period_open();

-- Every entry balances (checked at commit, once all its lines are in).
CREATE OR REPLACE FUNCTION accounting_entry_balanced() RETURNS trigger AS $$
DECLARE dr numeric; cr numeric; tot numeric;
BEGIN
  SELECT coalesce(sum("debit"), 0), coalesce(sum("credit"), 0) INTO dr, cr FROM "JournalLine" WHERE "entryId" = NEW."entryId";
  SELECT "total" INTO tot FROM "JournalEntry" WHERE "id" = NEW."entryId";
  IF dr <> cr OR dr <> tot THEN
    RAISE EXCEPTION 'journal entry % does not balance (debit %, credit %, total %)', NEW."entryId", dr, cr, tot USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "JournalLine_balanced" AFTER INSERT ON "JournalLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION accounting_entry_balanced();

-- Receipts, payments and their allocations are permanent; a receipt or payment is
-- never allocated beyond its amount (checked at commit).
CREATE TRIGGER "CustomerReceipt_append_only" BEFORE UPDATE OR DELETE ON "CustomerReceipt" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE TRIGGER "SupplierPayment_append_only" BEFORE UPDATE OR DELETE ON "SupplierPayment" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE TRIGGER "ReceiptAllocation_append_only" BEFORE UPDATE OR DELETE ON "ReceiptAllocation" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE TRIGGER "PaymentAllocation_append_only" BEFORE UPDATE OR DELETE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION sales_append_only();
CREATE OR REPLACE FUNCTION accounting_allocation_cap() RETURNS trigger AS $$
DECLARE used numeric; cap numeric;
BEGIN
  IF TG_TABLE_NAME = 'ReceiptAllocation' THEN
    SELECT coalesce(sum("amount"), 0) INTO used FROM "ReceiptAllocation" WHERE "receiptId" = NEW."receiptId";
    SELECT "amount" INTO cap FROM "CustomerReceipt" WHERE "id" = NEW."receiptId";
  ELSE
    SELECT coalesce(sum("amount"), 0) INTO used FROM "PaymentAllocation" WHERE "paymentId" = NEW."paymentId";
    SELECT "amount" INTO cap FROM "SupplierPayment" WHERE "id" = NEW."paymentId";
  END IF;
  IF used > cap THEN RAISE EXCEPTION 'allocated % of %', used, cap USING ERRCODE = 'check_violation'; END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "ReceiptAllocation_cap" AFTER INSERT ON "ReceiptAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION accounting_allocation_cap();
CREATE CONSTRAINT TRIGGER "PaymentAllocation_cap" AFTER INSERT ON "PaymentAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION accounting_allocation_cap();

-- ---------------------------------------------------------------------------
-- Default chart of accounts (kept small). System keys are what the posting rules
-- use; codes and names may be changed, keys may not be removed.
-- ---------------------------------------------------------------------------
INSERT INTO "Account" ("id", "code", "name", "nameAr", "type", "parentId", "postable", "systemKey") VALUES
  ('acc_1000', '1000', 'Assets', 'الأصول', 'asset', NULL, false, NULL),
  ('acc_1100', '1100', 'Cash on hand', 'النقدية بالخزينة', 'asset', 'acc_1000', true, 'cash'),
  ('acc_1200', '1200', 'Bank', 'البنك', 'asset', 'acc_1000', true, 'bank'),
  ('acc_1300', '1300', 'Accounts receivable', 'العملاء (ذمم مدينة)', 'asset', 'acc_1000', true, 'ar'),
  ('acc_1400', '1400', 'Inventory', 'المخزون', 'asset', 'acc_1000', true, 'inventory'),
  ('acc_1500', '1500', 'VAT input', 'ضريبة القيمة المضافة — مشتريات', 'asset', 'acc_1000', true, 'vat_input'),
  ('acc_1600', '1600', 'Employee advances', 'سلف العاملين', 'asset', 'acc_1000', true, 'employee_advances'),
  ('acc_2000', '2000', 'Liabilities', 'الخصوم', 'liability', NULL, false, NULL),
  ('acc_2100', '2100', 'Accounts payable', 'الموردين (ذمم دائنة)', 'liability', 'acc_2000', true, 'ap'),
  ('acc_2150', '2150', 'Goods received not invoiced', 'بضاعة مستلمة لم تصل فواتيرها', 'liability', 'acc_2000', true, 'grni'),
  ('acc_2200', '2200', 'VAT output', 'ضريبة القيمة المضافة — مبيعات', 'liability', 'acc_2000', true, 'vat_output'),
  ('acc_2300', '2300', 'Employee reimbursements payable', 'مستحقات العاملين', 'liability', 'acc_2000', true, 'employee_payable'),
  ('acc_3000', '3000', 'Equity', 'حقوق الملكية', 'equity', NULL, false, NULL),
  ('acc_3100', '3100', 'Capital', 'رأس المال', 'equity', 'acc_3000', true, 'capital'),
  ('acc_3200', '3200', 'Retained earnings', 'الأرباح المحتجزة', 'equity', 'acc_3000', true, 'retained_earnings'),
  ('acc_4000', '4000', 'Revenue', 'الإيرادات', 'revenue', NULL, false, NULL),
  ('acc_4100', '4100', 'Sales', 'المبيعات', 'revenue', 'acc_4000', true, 'sales'),
  ('acc_4200', '4200', 'Sales returns and allowances', 'مردودات ومسموحات المبيعات', 'revenue', 'acc_4000', true, 'sales_returns'),
  ('acc_5000', '5000', 'Cost of sales', 'تكلفة المبيعات', 'expense', NULL, false, NULL),
  ('acc_5100', '5100', 'Cost of goods sold', 'تكلفة البضاعة المباعة', 'expense', 'acc_5000', true, 'cogs'),
  ('acc_5200', '5200', 'Inventory adjustments and write-offs', 'تسويات وهالك المخزون', 'expense', 'acc_5000', true, 'inventory_adjustment'),
  ('acc_5300', '5300', 'Purchase price variance', 'فروق أسعار المشتريات', 'expense', 'acc_5000', true, 'ppv'),
  ('acc_6000', '6000', 'Operating expenses', 'المصروفات', 'expense', NULL, false, NULL),
  ('acc_6100', '6100', 'General expenses', 'مصروفات عمومية', 'expense', 'acc_6000', true, 'general_expenses'),
  ('acc_6200', '6200', 'Transport and fuel', 'نقل ووقود', 'expense', 'acc_6000', true, 'transport_expenses'),
  ('acc_6300', '6300', 'Salaries and wages', 'مرتبات وأجور', 'expense', 'acc_6000', true, 'salaries');
INSERT INTO "CashAccount" ("id", "code", "name", "type", "accountId") VALUES
  ('cash_main', 'CASH', 'الخزينة الرئيسية', 'cash', 'acc_1100'),
  ('bank_main', 'BANK', 'الحساب البنكي', 'bank', 'acc_1200');

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountingPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReceiptAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankReconciliation" ENABLE ROW LEVEL SECURITY;
