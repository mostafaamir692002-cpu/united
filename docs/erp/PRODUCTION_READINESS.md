# UNITED ERP — production readiness report

*Status reviewed 2026-10-09. The sections below preserve an earlier readiness report;
they are historical evidence, not a current production certification.*

> **Current status: not ready for production.** A separate PostgreSQL 17.11 disposable
> database applied all 42 migrations. The current verification run passed 90/90 unit
> tests, 62/62 database integration tests, and 6,520/6,520 checks across 21 end-to-end
> suites, including the 183-check UNITED go-live UAT and a 4,595-check hostile-input
> suite. TypeScript validation and an optimized production build also passed. These
> results establish behavior in the isolated test environment; they do not certify the
> configured company database or real UNITED data. The configured PostgreSQL at
> `localhost:5432` could not be reached during this review. Import regression coverage
> passed with synthetic CSV/XLSX data, but importing and reconciling UNITED's real
> workbooks, production ETA submission, and a production-backup restore drill remain
> unverified.
>
> Current changes: EGP-only API validation, ledger posting guards, database checks on
> currency-bearing records, expiry-aware availability, inventory idempotency payload
> checks, delivery shortage/damage/rejection reasons, and manual replenishment
> suggestions. Stock-count lines now reject duplicate product/location/lot buckets, and
> adjustment approval thresholds aggregate changes per product so splitting lines cannot
> bypass the configured limit; count buckets are locked while counted, and an approval is
> refused if that bucket changes before it is decided. Import request bodies are capped
> while streaming, even when Content-Length is absent. Period posting and month close now
> serialize through the same database lock, including direct SQL postings. An internal VAT period summary now shows document tax by code and rate,
> nets credit/debit notes, and compares the result against tax control accounts; it is
> not a statutory return. Initial data loading now supports both the existing manual cards and a
> CSV/XLSX upload with preview for customer/supplier cards and commercial terms, products and
> tax classes, product settings and packaging, customer/supplier opening balances,
> opening stock, sales prices and supplier prices. CSV import refuses nonempty cells beyond
> declared headers. XLSX uses the first worksheet, rejects formulas and malformed XML
> character references, and
> literal values only. The importer and screens have not yet been verified against
> UNITED's real master-data files. Manual orders persist customer and product card IDs;
> free-text unmatched records are accepted only through inbound integrations for later
> mapping. The EGP migration was applied locally after confirming there were no
> foreign-currency records. Current unit suite: 90/90; database integration suite: 62/62;
> 21 end-to-end suites: 6,520/6,520, including 26 data-import checks; TypeScript check and optimized production build:
> passed. Migration
> `20261009140000_serialize_accounting_period_posting` was applied to the disposable test
> database; deployment to the configured application database remains unverified because
> that database is unavailable from this review environment.

> **Update (scenario completeness audit, `SCENARIO_COMPLETENESS_AUDIT.md`).** A system-wide
> audit fuzzed every handler and probed ~250 edge scenarios. It found and fixed:
> - expired lots issued first to customers by FEFO (HIGH);
> - six money documents that were not retry-safe (HIGH);
> - a missing customer/supplier refund (HIGH, now built);
> - order prices editable after invoicing;
> - costing writable by the stock controller;
> - 94 triggerable server errors (ZERO-500 suite, 0 now).
>
> The verdict and totals in the earlier report are superseded by the current status
> above. Statutory functions (ETA production submission, VAT return, fixed assets,
> payroll) still require a verified operating process.

## Verdict

**Not certified as production-ready.** The historical report below describes intended
operational coverage. Production readiness requires populated and reconciled UNITED
master data, current role-based scenario tests against an isolated database, accountant
sign-off, the production ETA path, and a completed backup/restore drill.

It is **not yet** a complete replacement for Odoo's statutory functions: ETA e-invoice
submission, the VAT return, fixed assets and payroll stay on Odoo or a manual process
(section H).

| Evidence | Result |
|---|---|
| Unit tests | 90 / 90 passed |
| PostgreSQL integration tests | 62 / 62 passed on PostgreSQL 17.11 disposable database |
| End-to-end suites | 6,520 / 6,520 across 21 suites |
| Odoo-replacement UAT | 183 / 183 passed in the isolated test environment |
| TypeScript check | Passed (`npx tsc --noEmit --incremental false`) |
| Optimized production build | Passed from a temporary copy (no external font fetch) |
| Configured company database | Not reachable from this review environment |
| Real Odoo data import/reconciliation | Not verified |
| Production restore drill | Not verified |

## A. Operational scenario coverage — historical evidence, not current certification

The earlier UAT reported these connected flows end to end on realistic data, using the
role responsible for each step:
- quotation → order → preparation → loading → trip → partial delivery → invoice → receipt;
- shortage approval;
- failed delivery;
- customer and supplier returns;
- RFQ → PO → receiving with lots, expiry and sorting → bill → payment;
- transfers between cold rooms;
- counts with approval;
- employee expenses.

Final hardening:
- **Duplicate stock receipts are fixed.**
  - A sequential repeat, a burst of concurrent identical requests and a retry after a
    timeout all return the first receipt.
  - This holds for PO receipts too: the PO counts the receipt once, at the PO cost.
  - There is one stock movement and one GRNI posting.
  - Different keys are separate deliveries.
  - A reused key with a different quantity is refused.
  - Normal receiving, costing and stock ledger semantics are unchanged.

Known friction (by design, not errors):
- A shortage is approved again at loading.
- There is one warehouse only (no inter-warehouse transfer).

## B. Accounting scenario coverage — historical evidence, pending accountant decisions

- **Historical UAT result — exact journals.** Every source document posted exactly one balanced entry with the
  expected accounts and amounts: invoice, credit note, stock receipt, bill, debit note,
  money receipt, payment, stock movement, expense, manual journal.
- **Historical UAT result — health checks.** Accounts Health was green after the full scenario set: trial balance,
  nothing unposted, no orphan entries, AR/AP/inventory equal the GL in total and per
  party.
- **Statements and aging.** Statements equal aging. The aging bug for documents
  over-credited after payment was fixed in the UAT.
- **Period control.** Closed periods refuse postings. Corrections are reversal entries or
  credit and debit notes; document entries can't be reversed by hand.
- **Control accounts** (AR, AP, inventory, GRNI, employee balances) are closed to manual
  journals.

## C. Inventory scenario coverage — historical evidence

- **Historical UAT result — four-way agreement.** On hand, the stock ledger sum, the location/lot buckets and the
  valuation quantity agree for every product. The scenario totals match the physical
  story.
- **Health.** No negative balances.
- **Costing.** AVCO, consistent across issues, write-offs and returns.
- **Lots and expiry.** Lots carry expiry through transfers, and picking is FEFO.
- **Quarantine.** Quarantine works when a quarantine location is configured: excluded from
  available and from automatic picking, releasable by transfer or scrap. Configuring one
  is a management decision.

## D. Security / RBAC scenario coverage — historical evidence

- **Earlier test result — server-side enforcement.** Every API handler × every role was tested (RBAC matrix 247,
  security suite 73), and the UAT ran 36 out-of-responsibility attempts across 7 roles.
  All were refused by the server.
- **Field-level redaction.** The floor never sees prices or costs.
- **Segregation of duties.**
  - The bill variance approver is not the bookkeeper.
  - The expense approver is not the payer.
  - The count approver is not the counter.
- **Credentials.** ETA credentials live in the server environment only.
- **Lockouts.** Sign-in lockout is stored in the database.
- **Cutover check:** no demo account may exist in production (`CUTOVER.md` §4.1).

## E. Data migration readiness — READY WITH CONDITIONS

- **Go-live data entry:** master cards can be entered manually or loaded from CSV/XLSX
  with a preview; opening balances per customer/supplier and opening stock per product/lot have
  guided entry paths. Sales and supplier price rows can also be loaded by CSV/XLSX.
  Cash, bank and capital still go in by manual journal. Importing Odoo's workbook
  directly, mapping its columns and reconciling a real export still need cutover work.
- **Cut-off rules must be decided first** (`CUTOVER.md` §2): Odoo GRNI, open orders and
  POs, overdue receivables.
- **A migrations-only database is audited** (`CUTOVER.md` §1). Before opening balances it
  still needs:
  - the company tax number;
  - the permission sync;
  - one default price list;
  - production's existing users.

## F. ETA readiness — NOT READY FOR PRODUCTION

Built and tested:
- mapping to Invoice v1.0;
- validation with per-field missing-data detection;
- idempotent submission;
- permission boundaries;
- credential isolation;
- a status screen.

Not done:
- **Verification against the official SDK.** It was unreachable from this environment.
- **ETA credentials, the e-seal signing bridge, registered item codes and unit-type
  codes.**
- **The accountant's confirmation of the tax subtypes.**

Until these are done, e-invoices are submitted through the ETA portal or Odoo.

## G. Backup / recovery coverage — disposable drill evidence; production drill outstanding

- **Procedure and tooling** are in `BACKUP_RESTORE.md` and `scripts/ops/restore-check.ts`.
- **Disposable-database drill:**
  - `pg_dump` → restore into a new database;
  - 87 tables, 3,692 rows, 0 differing; migrations 36 = 36;
  - the business fingerprint (master data, inventory, ledger, lots, invoices, AR, AP, GL,
    audit) is identical;
  - Accounts Health ok and Inventory Health ok on the copy;
  - all 8 roles sign in;
  - the database rules (append-only ledgers, journal balance) are enforced on the copy.
- **Outstanding:** one drill against a real production backup, into a separate database or
  Supabase branch, before go-live. Enable point-in-time recovery and daily off-site
  dumps.

## H. Remaining Odoo (or manual) dependencies

1. ETA e-invoice submission.
2. VAT return / tax declaration. A period summary now compares invoice/bill tax and credits/debits to GL 1500/2200. It is an internal reconciliation aid, not the official return format; mapping the authority's form and accountant sign-off remain.
3. Fixed assets and depreciation.
4. Payroll.
5. Direct Odoo workbook mapping and import of separate contact profiles / ETA identifiers. Current templates cover cards, customer credit terms, product tax and inventory settings/packaging, dated prices, and opening stock and balances; mapping and reconciliation against UNITED's real exports remain.
6. A second warehouse (inter-warehouse transfers).

## I. Decisions for management and the accountant

1. Costing method per product: AVCO (current default) or FIFO.
2. ETA tax subtypes:
   - exempt fresh produce: V003 or V004;
   - VAT14: V009;
   - VAT0: V001.
3. The person-ID threshold for B2C e-invoices (50,000 EGP).
4. Whether returns go to quarantine (one master-data location if yes).
5. Keep the second shortage approval at loading, or change the rule.
6. Cut-off rules: the date, Odoo GRNI, open orders and POs, overdue receivables.
7. Tax recognition basis: the internal summary follows invoice/bill dates; cash-basis
   tax adjustments are not implemented. Confirm the filing basis with the accountant.
8. Purchase-price differences: bill variances currently post to PPV (5300) without
   revaluing individual inventory lots. Confirm this treatment with the accountant.
9. Sign-off of the opening trial balance against Odoo.

## J. Exact cutover checklist

Detailed checks are in `CUTOVER.md`; backup steps are in `BACKUP_RESTORE.md`.

**Before the cutover day**
1. Get the decisions in section I, and the cut-off rules in writing.
2. Production:
   - take a backup;
   - deploy the release;
   - run `npx prisma migrate deploy` (42 migrations in this checkout) and `npm run db:sync-permissions`;
   - check `GET /api/health`.
3. Verify `CUTOVER.md` §4.1:
   - migrations, permissions, an administrator, the company tax number, the default price
     list;
   - every demo-account sign-in fails.
4. Run the restore drill against the production backup (`BACKUP_RESTORE.md`), including
   `db-compare` and the fingerprint. Enable point-in-time recovery and daily off-site
   dumps.
5. Load master data: customers (B2B tax numbers), suppliers, products (CSV or manual;
   verify unit, tax class, costing and shelf life), product packaging, one default price list and
   its dated prices, users.
6. Re-create open POs. Re-enter undispatched sales orders.

**Cutover day**
7. Stop posting in Odoo at the cut-off time, and settle Odoo GRNI per the decided rule.
8. Do a physical stock count.
9. In UNITED → الأرصدة الافتتاحية:
   - opening stock per product and lot (cost from Odoo);
   - opening balances per customer and supplier (with due dates);
   - one manual journal for cash, bank and capital.
10. Verify `CUTOVER.md` §4.3:
    - statements = Odoo per party;
    - aging and GL 1300/2100 = Odoo;
    - stock = count;
    - valuation and GL 1400 = Odoo;
    - trial balance = Odoo's;
    - Accounts Health ok and Inventory Health ok.
11. Go/no-go (`CUTOVER.md` §5). On no-go, stay on Odoo.
12. Take a backup immediately after the opening balances.

**First live day and first month**
13. Smoke test with real documents (`CUTOVER.md` §4.4), then check Accounts Health and
    Inventory Health at day end.
14. Submit e-invoices through the ETA portal or Odoo for invoices issued in UNITED.
15. Run the first monthly close in parallel with Odoo's view of the same month: compare
    the trial balance, AR/AP aging and stock valuation, then set Odoo read-only for the
    migrated scope.
