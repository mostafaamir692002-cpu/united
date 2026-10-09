# Database migration runbook

The production database is real. These are the rules every schema change follows, and
the procedures for the migrations that can stop a deploy on purpose.

## Rules

1. **Production changes go through `npx prisma migrate deploy` only.** Never `db push`,
   never `migrate dev`, never `migrate reset` against it.
2. **Additive first.** New tables, nullable columns, new indexes. A `NOT NULL` column on
   an existing table ships with a default or a backfill in the same migration.
3. **A migration that could reinterpret data stops instead.** Pre-flight checks raise an
   exception with an explanation; they never pick a winner between conflicting rows.
4. **Review the generated SQL.** Prisma proposes dropping anything it does not see in
   `schema.prisma` — hand-made indexes included. Declare them in the schema (as was done
   for `RolePermission_permissionId_idx` and `UserPermissionOverride_permissionId_idx`)
   rather than deleting the `DROP` line and hoping.
5. **Constraints that existing rows might violate** are added `NOT VALID` (enforced for
   new writes immediately), then validated once the data has been inspected.
6. **Before deploying:** take a backup (Supabase: Database → Backups, or `pg_dump`),
   then run `npx prisma migrate status` to see exactly what will apply.
7. **After deploying:** `npm run db:sync-permissions` (idempotent), then check
   `GET /api/health`.

## Generating a migration

`migrate dev` refuses to run non-interactively when a change could fail on existing
data. Generate the SQL with a throwaway shadow database instead:

```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://…/scratch_shadow \
  --script > prisma/migrations/<timestamp>_<name>/migration.sql
```

Then add CHECK constraints, RLS (`ENABLE ROW LEVEL SECURITY`, no policies — same posture
as every other table) and any pre-flight checks by hand, apply locally, and confirm no
drift remains:

```bash
npx prisma migrate deploy
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --exit-code   # exit 0 = in sync
```

## Recovering from a migration that stopped itself

A migration with a pre-flight check fails *before* changing anything. To recover:

1. Read the error. It names the problem and points here.
2. Fix the data (below), with a human deciding which rows are right.
3. Mark the failed attempt as rolled back, then deploy again:
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   npx prisma migrate deploy
   ```

## Known pre-flight checks

### `externalId duplicates` — `20261008122319_order_integrity_hardening`

Makes `Order.externalId` unique. Stops if two orders already share an external id (the
same n8n / Hermes message became two orders). Find them:

```sql
SELECT "externalId", array_agg("orderNumber" ORDER BY "createdAt") AS orders
FROM "Order"
WHERE "externalId" IS NOT NULL
GROUP BY "externalId"
HAVING count(*) > 1;
```

For each group, decide which order is the real one (normally the earliest, unless work
was done on a later one). Keep that one's `externalId`. On the others, **do not delete
the order** — clear the link and leave a trace:

```sql
UPDATE "Order"
SET "externalId" = NULL,
    "notes" = coalesce("notes" || E'\n', '') || 'duplicate of external id <id>, unlinked before migration'
WHERE "orderNumber" IN ('<duplicate order numbers>');
```

Cancel the duplicates through the app (with a reason) if they should not be fulfilled.

### `inventory engine` — `20261008131333_inventory_engine`

Converts the stock ledger from `Float` kilograms to `Decimal(18,3)` quantities
(`quantityKg` → `quantity`, intake `receivedKg/rejectedKg/goodKg` → `*Qty`), places
every existing movement in the main warehouse's receiving bay (`wh_main` / `loc_recv`),
adds lots, documents, reservations, valuation layers and the database guards. Columns
are **renamed and converted in place**. Nothing is dropped and no row is rewritten
beyond the type change, so balances before and after are identical (verified on a copy
of the data).

It stops, changing nothing, in two cases:

1. **`loc_recv` is missing.** It is created by `…_add_org_master_data`. Deploy
   migrations in order. If it was deleted by hand, recreate it with the same id
   (`loc_recv`, warehouse `wh_main`, code `RECV`, type `receiving`).
2. **A quantity has more than 3 decimals.** Converting it would change a recorded
   weight. Find the rows:
   ```sql
   SELECT id, "productId", "quantityKg", "createdAt" FROM "StockMovement"
   WHERE "quantityKg"::numeric <> round("quantityKg"::numeric, 3);
   SELECT id, "receiptNumber", "receivedKg", "rejectedKg", "goodKg" FROM "StockIntake"
   WHERE "receivedKg"::numeric <> round("receivedKg"::numeric, 3)
      OR "rejectedKg"::numeric <> round("rejectedKg"::numeric, 3)
      OR "goodKg"::numeric     <> round("goodKg"::numeric, 3);
   ```
   These come from floating-point artefacts such as `12.300000000001`. A person decides
   the intended weight, normally the 3-decimal rounding. The movement table was not yet
   append-only at this point, so the correction is a plain `UPDATE` of those rows to the
   rounded value. Record what was changed (ids, old and new values) in the deployment
   notes. Then `migrate resolve --rolled-back` and deploy again.

After it runs, it **reports, not fails**, products whose balance is already negative
(a `NOTICE` in the deploy log). These buckets come from the pre-Phase-1 void/correction
bug. The new rules never refuse an *addition*, so a stock controller corrects each one
with a positive adjustment (with a reason). Removals from that bucket are refused until
then.

Valuation: history has no prices, so existing stock gets valuation layers at cost
`unknown` (value 0). The valuation report shows this as "received without cost".
Average cost is understated until that stock has left.

### `stock_movement_sequence`

Adds `StockMovement.seq` (BIGSERIAL): the ledger's total order, used by FIFO costing.
Existing rows are numbered by `(createdAt, id)`. That `UPDATE` is the only write ever
made to existing movements, and it runs with the append-only trigger disabled for that
one statement inside the migration's transaction. If the migration fails partway, the
transaction rolls back and the trigger is never left disabled. Afterwards, check that
the trigger is enabled:
```sql
SELECT tgenabled FROM pg_trigger WHERE tgname = 'StockMovement_append_only';  -- 'O'
```

### `stock_issue_exceptions`

Additive (new table, CHECKs, RLS). No pre-flight is needed.

### Phase 3 (sales) — `…_sales_customers`, `…_sales_pricing`, `…_sales_quotations_credit`, `…_sales_invoicing`

All additive: new tables, nullable columns on `Order` (`customerAccountId`,
`creditStatus`, `creditNote`), and a `StockProduct.salesTaxCode` column defaulting
to `EXEMPT`. `…_sales_pricing` inserts the three tax classes **before** adding the
product → tax foreign key, so existing products are valid the moment it applies.
`…_sales_customers` widens the role CHECKs (adds `SALES`, `ACCOUNTANT`) and the
permission-group CHECK (adds `sales`); no user's role changes. Run
`npm run db:sync-permissions` after deploying so the role bundles include the new
permissions.

`…_sales_invoicing` installs triggers that make issued invoices and credit notes
immutable. There is no supported way to edit one; a wrong invoice is corrected with a
credit note. Do not disable these triggers to "fix" data. If an issued invoice is
genuinely wrong (for example, a wrong customer), issue a full credit note and invoice
again.

No pre-flight is needed: no existing data is reinterpreted. Existing orders start
with no customer account (they appear in the "unmapped names" queue) and no prices
(they are priced when their customer or product is mapped, or by "reprice").


### Phase 4 (purchasing) — `…_purchasing_suppliers`, `…_purchasing_orders`, `…_purchasing_bills`

`…_purchasing_suppliers` is the one Phase 4 migration that **writes existing rows**:
every existing supplier gets a code. It adds `Supplier.code` as nullable, numbers the
existing suppliers `SUP-00001…` in creation order (`createdAt`, then `id`, so the
result is deterministic), moves the `purchasing.supplier` sequence counter past the
last number used (never backwards, if one already exists), and only then makes the
column `NOT NULL` and unique. No other supplier field is touched. To preview the
codes before deploying:
```sql
SELECT "id", "name", 'SUP-' || lpad(row_number() OVER (ORDER BY "createdAt", "id")::text, 5, '0') AS code
FROM "Supplier" ORDER BY "createdAt", "id";
```
It also widens the role CHECKs (adds `PURCHASER`) and the permission-group CHECK (adds
`purchasing`). The new tax registration number is unique but starts empty, so it
cannot conflict with existing data.

`…_purchasing_orders` and `…_purchasing_bills` are additive: new tables, and two
nullable columns on `StockIntake` (`purchaseOrderLineId`, `rejectionReason`). Existing
receipts stay unlinked and are billable like any receipt without a PO (matched against
the cost recorded on them, else the supplier's dated price, else they need approval).

`…_purchasing_bills` installs triggers that make posted (and cancelled) supplier bills
and their lines immutable, and debit notes append-only. A wrong posted bill is
corrected with a debit note; do not disable the triggers. Two partial unique indexes
back the service checks: one supplier invoice number per supplier among live bills
(case and surrounding spaces ignored), and one live bill per receipt.

Run `npm run db:sync-permissions` after deploying: the role bundles gain the
`purchasing.*` permissions (including `purchasing.bills.approve`, held only by
SUPER_ADMIN by default).

### Phase 5 (operations) — `…_operations_trips`

Additive: new tables (vehicles, drivers, trips, stops, delivery lines, operational
exceptions) and two nullable columns on `Order` (`assignedToId`, `assignedToName`).
Existing orders are on no trip and keep their current dispatch path; nothing is
reinterpreted. Installs: one live trip per order (partial unique index), the delivery
line balance CHECK (shipped = delivered + short + damaged + rejected) and an
append-only trigger on delivery lines. Widens the permission-group CHECK for
`operations`, `accounting`, `hr`, `integrations`. Run `npm run db:sync-permissions`
afterwards (new `operations.trips.manage` for supervisors).

### Phase 6 (accounting) — `…_accounting_core`

Additive: chart of accounts, periods, journals, cash accounts, receipts, payments,
allocations, reconciliations; seeds the default chart (26 accounts) and two cash
accounts (main cash, main bank). Installs: append-only journals, receipts, payments
and allocations; a deferred balance check per journal entry; a closed-period guard; a
header-account guard; a deferred allocation cap; one entry per source document.
After deploying: `npm run db:sync-permissions` (five `accounting.*` permissions for
ACCOUNTANT), then `POST /api/accounting/sync` once to post invoices, credit notes,
bills and debit notes issued before the ledger existed, plus the stock valuation to
date. Opening balances (cash, bank, capital, pre-system receivables/payables) are
entered as one manual journal dated the go-live day.

### Phase 8 (HR) — `…_hr_expenses`

Additive: departments, employees, expenses, employee transactions (append-only). Widens
two journal CHECKs (party type `employee`; source types `expense`,
`employee_transaction`) — both are relaxations, so no existing row can violate them.
Run `npm run db:sync-permissions` (four `hr.*` permissions).

### Phase 9 (integrations) — `…_integrations`

Additive: `Integration` (key hash, scopes) and an append-only `IntegrationLog`. No
existing data touched. After deploying: `npm run db:sync-permissions`; create one key
per channel under الإدارة → التكاملات, switch each n8n/Hermes flow to its own key, then
remove `N8N_API_KEY` from the environment.

### Phase 10 — `…_login_attempts`, `…_hot_path_indexes`

`…_login_attempts`: new append-only table; the in-memory lockout state is not
migrated (it never persisted). `…_hot_path_indexes`: three plain `CREATE INDEX` on
`AuditLog`, `StockMovement`, `StockValuationLayer` — they briefly block writes on those
tables while building; at UNITED's volume that is seconds. On a much larger database,
run them by hand with `CREATE INDEX CONCURRENTLY` first (same names) and the migration
becomes a no-op… after marking it applied with `prisma migrate resolve --applied`.

### Connected ERP — `…_connected_ledger`, `…_money_idempotency`, `…_money_reversals`

`…_connected_ledger`: new append-only `StockValuationPosting` (movement → journal entry)
and `PartyOpeningBalance`; account **3300 opening-balance equity**; widens the journal
source CHECK (`opening_balance`). It **writes rows**: it marks the valuation layers already
covered by the earlier batch runs as posted, so per-movement posting never posts them
twice. This is idempotent (`ON CONFLICT DO NOTHING`), and to preview the count:
`SELECT count(*) FROM "StockValuationLayer" WHERE "createdAt" <= (SELECT max(split_part("sourceId", '|', 1)::timestamptz) FROM "JournalEntry" WHERE "sourceType" = 'stock_valuation' AND "sourceId" LIKE '%|%');`
After deploying, run `POST /api/accounting/sync` once: it posts any movement made after the
last batch run. Then check `/accounting` → سلامة الحسابات.

`…_money_idempotency`: two nullable unique columns; existing rows keep NULL.

`…_money_reversals`: two new append-only tables; widens the journal source CHECK
(`receipt_reversal`, `payment_reversal`). Both are relaxations, so no existing row is touched.

Manual journals are now refused on control accounts (AR, AP, inventory, GRNI, employee
balances). If production already has manual lines on them, the integrity screen shows any
resulting difference. Correct it with the proper document, not another journal.

### ETA e-invoicing — `…_eta_compliance`

Additive: six new tables (`EtaIssuerProfile`, `EtaReceiverProfile`, `EtaItemCode`,
`EtaUnitType`, `EtaDocument`, `EtaDocumentEvent`). No existing table, column or row is
touched; invoices, numbering, credit notes and the ledger are unchanged. Guards: one
`EtaDocument` per source document (unique), ETA state can never be deleted (trigger), its
event history is append-only. After deploying: `npm run db:sync-permissions` (two
`accounting.eta.*` permissions: ACCOUNTANT both, SUPERVISOR view).

### Final hardening — `…_stock_receipt_idempotency`

Additive: one nullable unique column `StockIntake.idempotencyKey`; existing receipts keep
NULL. The receiving screen sends one key per filled form; a retried, timed-out or
duplicated request returns the first receipt instead of posting stock and GRNI twice.
Requests without a key behave exactly as before.

### Scenario completeness audit — `…_party_refunds`, `…_money_document_idempotency`

`…_party_refunds`: two new append-only tables, `CustomerRefund` (money paid back to a
customer out of the credit they hold) and `SupplierRefund` (a supplier paying back credit
we hold with them). CHECKs (number shape, amount > 0, known method, reason required), the
append-only trigger and RLS, as for receipts and payments. It also widens the journal
source CHECK (`customer_refund`, `supplier_refund`). That is a relaxation, so no existing
row is touched.

`…_money_document_idempotency`: a nullable unique `idempotencyKey` on `CreditNote`,
`DebitNote`, `PartyOpeningBalance`, `Expense` and `EmployeeTransaction`. Existing rows keep
NULL, and a unique index ignores NULLs, so nothing can conflict. Manual journals need no
column: a keyed journal uses `manual-<key>` as its source id.

The forms send one key per filled form. A retried or timed-out submit returns the first
document instead of posting twice. Requests without a key behave exactly as before.
After deploying: `npm run db:sync-permissions`. No new permissions are added, but it is
harmless.
