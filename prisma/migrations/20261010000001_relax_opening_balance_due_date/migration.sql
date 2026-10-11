-- Allow opening balances to carry their original overdue due dates
-- (at go-live import from Odoo, the due date is when the balance was
-- originally due, which may be before the go-live date).
ALTER TABLE "PartyOpeningBalance" DROP CONSTRAINT IF EXISTS "PartyOpeningBalance_values";

-- Re-add the constraint without the dueDate >= date restriction
ALTER TABLE "PartyOpeningBalance" ADD CONSTRAINT "PartyOpeningBalance_values" CHECK (
  "partyType" IN ('customer', 'supplier') AND
  "amount" <> 0 AND
  "date" ~ '^\d{4}-\d{2}-\d{2}$'
);