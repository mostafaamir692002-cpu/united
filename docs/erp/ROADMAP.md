# UNITED ERP — Execution roadmap

Live status of the phased plan in `ASSESSMENT.md` §11. A line is ✅ only when its data
model, migration, service, API, authorization, validation, audit, UI (where it has
one) and tests all exist and the full suite is green.

## Phase 1 — Foundation

| Item | Status | Where |
|---|---|---|
| Architecture assessment & gap analysis | ✅ | `docs/erp/ASSESSMENT.md` |
| Test safety guard (suites refuse non-test databases) | ✅ | `tests/_guard.ts` |
| Reproducible test baseline from fixtures | ✅ | `tests/reset-db.ts`, `prisma/seed.ts` |
| Unit test layer for pure rules | ✅ | `tests/unit/*` (`npm run test:unit`) |
| Atomic audit (audit row commits with its change, compiler-enforced) | ✅ | `lib/audit.ts`, `lib/tx.ts`, all services |
| No path to negative stock (void / correction / adjustment) | ✅ | `lib/stock-service.ts` `assertBalanceCovers` |
| Configuration service + shortage tolerance and time thresholds as settings | ✅ | `lib/core/settings-*`, admin → إعدادات التشغيل |
| Malformed JSON → 400 on every route | ✅ | `lib/http.ts` |
| Order date/time validation → 400 (was 500) | ✅ | `lib/dates.ts`, `orders-service` |
| `Order.externalId` unique, with pre-flight | ✅ | migration `…_order_integrity_hardening`, `MIGRATIONS.md` |
| Constant-time integration key check; login timing equalized | ✅ | `lib/api-auth.ts`, login route |
| Organisation master data: company, branch, warehouse, storage location | ✅ | `lib/core/org-service.ts`, admin → الشركة والمخازن والوحدات |
| Units of measure (Decimal conversion; package units per product) & currencies | ✅ | `lib/core/uom.ts`, same screen |
| Namespaced ERP permissions (`core.masterdata.view/manage`) | ✅ | `lib/permissions.ts`, migration `…_permission_namespaces` |
| Document numbering (atomic, gapless for committed documents, per-period reset) | ✅ | `lib/core/sequences.ts`, `NumberSequenceCounter` |
| Approval engine (typed requests, levels, one-pending invariant, handlers run in the deciding transaction, segregation-of-duties setting) — order shortage gate runs through it | ✅ | `lib/core/approvals.ts`, `lib/core/approval-handlers.ts`, `/approvals` |
| Notification centre (in-app, written in the causing transaction, recipients by effective permission, deduplicated) | ✅ | `lib/core/notifications.ts`, header bell |
| Document attachments (Supabase Storage bytes / PostgreSQL metadata, provider interface, content sniffing, per-record permissions, idempotent upload, soft delete) | ✅ | `lib/core/attachments.ts`, `lib/core/storage/*`, order screen → المستندات |
| Session invalidation on password change | ✅ | `User.sessionEpoch`, `lib/authz.ts` |

**Phase 1 complete (2026-10-08).** Remaining Phase 1 follow-ups carried forward:
approval escalation (pending too long → notify SUPER_ADMIN) needs a scheduler; external
notification channels arrive with Phase 9.

## Security & identity (RBAC audit, 2026-10-08)

| Item | Status | Where |
|---|---|---|
| Generated RBAC matrix (roles × permissions, pages, every API handler) | ✅ | `docs/erp/RBAC_MATRIX.md`, `scripts/rbac/matrix.ts` |
| Gate snapshot: any change to who may do what fails a unit test until the snapshot is regenerated (reviewed diff) | ✅ | `docs/erp/rbac-snapshot.json`, `tests/unit/rbac-snapshot.test.ts` |
| Generated enforcement test: every handler × every role lacking its permission → 403; anonymous → 401; every page × every role | ✅ | `tests/security.test.ts` (434 denial calls per run) |
| Stock costs redacted from every stock/inventory response without `stock.valuation.view` (one function, not per route) | ✅ | `lib/security/redact.ts` |
| Order credit state carries no amounts or hold reasons (floor roles read orders); credit requests raised by the control, not the floor user | ✅ | `lib/sales/credit.ts` |
| Order timelines hide pricing, credit and invoice events from roles without those permissions | ✅ | `lib/security/audit-visibility.ts` |
| Only a SUPER_ADMIN may edit, disable, demote, reset or sign out a SUPER_ADMIN | ✅ | `assertMayManage` |
| Nobody changes their own role or their own permission overrides | ✅ | `admin-service` |
| Sign out everywhere (per user); disabling a user ends their sessions | ✅ | `/api/admin/users/:id/sessions/revoke` |
| Self-service password change (current password required, rate-limited, other sessions end) | ✅ | `/account/password`, `/api/auth/password` |
| Admin-set password can require a change at next sign-in (session has no permissions until then) | ✅ | `User.mustChangePassword` |
| Effective permissions per user: base role, ✓/✗ with source (role / override), override summary | ✅ | admin → المستخدمين → الصلاحيات الفعلية |
| Tax classification moved to finance (`sales.tax.manage`); accountant has no operations reports | ✅ | `lib/permissions.ts` |
| MFA for SUPER_ADMIN and ACCOUNTANT | ⏳ | Phase 10 (hardening) |
| Password policy beyond length (breached-password list, no username in password) | ⏳ | Phase 10 |
| Active-session list per user (device, last seen) — today sessions are stateless JWT + epoch | ⏳ | Phase 10 |
| Login lockout shared across server instances (today in-memory, single node) | ⏳ | Phase 10, before running more than one instance |
| Failed sign-ins persisted to the security audit | ⏳ | Phase 10 |
| Per-integration API credentials (today one key for n8n/Hermes) | ⏳ | Phase 9 |

## Phase 2 — Inventory core

| Item | Status | Where |
|---|---|---|
| Decimal(18,3) ledger; Float columns converted in place with pre-flight (balances verified identical) | ✅ | migration `…_inventory_engine`, `lib/inventory/decimal.ts` |
| Append-only ledger, enforced by the database (movements; valuation layers except FIFO `remainingQty`) | ✅ | triggers in `…_inventory_engine` |
| Bucket (product × location × lot) can never go negative, for any writer | ✅ | trigger `stock_bucket_never_negative` + per-bucket locks |
| Single write path, global lock order (availability → valuation → bucket), no deadlock on opposing transfers | ✅ | `lib/inventory/ledger.ts` `postMovements`, `lockForMoves` |
| Ledger total order (`seq`) for deterministic FIFO | ✅ | migration `…_stock_movement_sequence` |
| Warehouses / locations on every movement; cold-chain products refuse dry locations | ✅ | `ledger.ts` validation |
| Lots per receipt, expiry from shelf life or entered; expiry correction with reason | ✅ | `stock-service.createIntake`, `lib/inventory/products.ts` |
| FEFO / FIFO picking; quarantine never picked | ✅ | `lib/inventory/picking.ts` |
| Multi-line documents never double-pick (per-document claims) | ✅ | `PickClaims` |
| Product packaging conversions (exact or refused); base unit must be a real, non-package unit | ✅ | `lib/inventory/packaging.ts`, `product-master-service` |
| Reservations: available = on-hand − quarantined − reserved; removals respect others' reservations | ✅ | `lib/inventory/reservations.ts` |
| Documents: transfer, count/adjustment, scrap, customer return (→ quarantine), supplier return, reversal | ✅ | `lib/inventory/documents.ts`, `/api/inventory/*` |
| Adjustment approval above a configurable threshold (approval engine) | ✅ | setting `inventory.adjustment_approval_threshold` |
| Idempotency keys on every document | ✅ | `idempotent()`; UI sends a key per attempt |
| Valuation foundation: AVCO / FIFO / standard, a layer per movement, cost hidden without `stock.valuation.view` | ✅ | `ledger.ts`, `reports.valuationReport` |
| **Connected flow:** order dispatch issues stock in the same transaction; reopen reverses it; cancel releases reservations | ✅ | `lib/inventory/dispatch.ts`, `orders-service` |
| Dispatch exceptions (unmapped / unit mismatch / insufficient) queued, notified, resolved with reason; lenient/strict policy setting | ✅ | `StockIssueException`, setting `inventory.dispatch_issue_policy` |
| Reports: stock by product with reorder/min flags, expiring lots, valuation | ✅ | `lib/inventory/balances.ts`, `reports.ts` |
| Tablet UI: stock, product drill-down (buckets in pick order, reservations, settings, packaging), movement forms, expiring, dispatch exceptions, documents, valuation; receiving with location / expiry / price / packages | ✅ | `/stock/inventory`, `/stock/entries` |
| Inter-warehouse transfers (in transit) | ⏳ | transfers are within one warehouse; a second warehouse needs a transit location and two-step receipt |
| Count sessions (count sheet for a whole room, blind count) | ⏳ | counts are per line today |
| Automatic reservation when an order is confirmed | ⏳ | Phase 3: sales orders reserve on confirmation; reservations are manual or by API until then |
| Valuation posted to the general ledger (inventory / COGS) | ⏳ | Phase 6 consumes the valuation layers; no new stock data is needed |

**Phase 2 core complete (2026-10-08).** The ⏳ lines are carried into the phases named.

## Phase 3 — Sales

| Item | Status | Where |
|---|---|---|
| Roles SALES and ACCOUNTANT; `sales.*` permissions (customers, credit, pricing, override, quotations, invoices) | ✅ | `lib/permissions.ts`, migration `…_sales_customers` |
| Customer master: CUS- codes, type, Egyptian tax id (9 digits, unique), contacts (one primary), delivery notes, integration id | ✅ | `lib/sales/customers.ts`, `/sales` |
| Exact customer identity for incoming orders (integration id → name / Arabic name / alias); unmapped queue; mapping links open orders in one audited step | ✅ | `resolveCustomer`, `mapOrderCustomerName` |
| Credit terms (days, Decimal limit, hold with reason) — finance-only, audited per field with reason | ✅ | `updateCustomerCredit` |
| Price lists with dated prices (history never edited; same-day correction only while unused); customer list → default fallback; packaging-unit pricing | ✅ | `lib/sales/pricing.ts` |
| Tax classes (EXEMPT / VAT14 / VAT0, ETA type/subtype) per product | ✅ | `TaxRate`, `StockProduct.salesTaxCode` |
| Order lines priced on arrival (own table, never on floor payloads); repriced when customer/product mapping is decided; manual override with reason | ✅ | `OrderItemPrice`, `/api/orders/:id/pricing` |
| Decimal line arithmetic, per-line half-up rounding | ✅ | `lib/sales/money.ts` (unit tested) |
| Quotations → orders (through the one order-creation path, quoted prices kept, at most one order per quotation) | ✅ | `lib/sales/quotations.ts` |
| Credit control off / warn / block via the approval engine; exposure = un-invoiced orders + receivable | ✅ | `lib/sales/credit.ts`, setting `sales.credit_check_mode` |
| Automatic stock reservation for orders (best-effort, re-synced on edits) | ✅ (default off) | `lib/sales/fulfilment.ts`, setting `sales.auto_reserve` |
| Invoices from dispatched orders on what left; gapless numbers at issue; frozen buyer snapshot; DB-enforced immutability | ✅ | `lib/sales/invoicing.ts`, migration `…_sales_invoicing` |
| Credit notes by line quantity or in full, never over-credited (proven concurrently) | ✅ | `createCreditNote` |
| Receivable, customer statement, aging | ✅ | `/api/sales/customers/:id/statement`, `/api/sales/reports/aging` |
| Printable tax invoice (A4) | ✅ | `/sales/invoices/:id/print` |
| Customer returns ↔ credit notes linked automatically | ◐ | a credit note can reference a return document; creating one from the other is manual |
| Proof of delivery adjusting invoiced quantities | ⏳ | Phase 5 (trips, POD) |
| Payments and allocation against invoices | ⏳ | Phase 6 (cash/bank) — receivable is invoices − credit notes until then |
| Journal entries for invoices / credit notes / COGS | ⏳ | Phase 6 consumes invoices, credit notes and the issue documents' valuation layers |
| ETA e-invoice submission | ⏳ | Phase 9 adapter; tax classes and buyer tax ids are already captured |

**Phase 3 complete (2026-10-08).** The ⏳ lines belong to the phases named.

## Phase 4 — Purchasing

| Item | Status | Where |
|---|---|---|
| Role PURCHASER; `purchasing.*` permissions (suppliers, prices, RFQ, orders, approve, bills, bill-variance approval) | ✅ | `lib/permissions.ts`, migration `…_purchasing_suppliers` |
| Supplier master: SUP- codes (existing suppliers numbered in creation order), type, Egyptian tax id (unique), payment terms, lead time, currency, contacts (one primary) | ✅ | `lib/purchasing/suppliers.ts`, `/purchasing` |
| Supplier prices: dated rows per product and unit, never edited after a PO used them; per-product comparison across suppliers | ✅ | `setSupplierPrices`, `effectiveSupplierPrice` |
| RFQ to several suppliers → supplier quotations → comparison (cheapest per line) → award: one draft PO per supplier at the quoted price | ✅ | `lib/purchasing/rfq.ts` |
| Purchase orders: priced from agreed price or quotation (typed price needs `prices.manage`), packaging units converted to base, Decimal totals; draft → approval above a configurable threshold → approved → sent | ✅ | `lib/purchasing/orders.ts`, approval type `purchasing.order`, setting `purchasing.po_approval_threshold` |
| Receiving against a PO line: supplier, product and unit cost come from the line (the gate never sees prices); only approved/sent orders; good quantity held to an over-receipt tolerance under a per-PO lock (proven concurrently) | ✅ | `lib/purchasing/receiving.ts`, `createIntake`, setting `purchasing.over_receipt_tolerance_pct` |
| PO received status derived from posted receipts (never stored), re-derived on every receipt, correction and void; audited | ✅ | `refreshPoReceiptStatus` |
| Sorting / quality at the gate: rejected quantity and its reason on the receipt, shown on the PO line | ✅ | `StockIntake.rejectionReason` |
| Lots and expiry on receipt; stock and valuation at the PO cost | ✅ | Phase 2 engine, cost from `poLineUnitCost` |
| Supplier bills from receipts: three-way match per line (agreed price × good qty vs billed), tolerance → post, else approval by `purchasing.bills.approve`; duplicate supplier invoice refused; a receipt on one live bill only (both DB-enforced); posted bills immutable (triggers); billed receipts frozen | ✅ | `lib/purchasing/bills.ts`, `lib/purchasing/match.ts` (unit tested), migration `…_purchasing_bills` |
| Debit notes by quantity per line or in full, never over-debited (proven concurrently), append-only; optional link to a supplier-return document | ✅ | `createDebitNote` |
| Payables foundation: supplier balance, statement, AP aging | ✅ | `/api/purchasing/suppliers/:id/statement`, `/api/purchasing/reports/ap-aging`, `/purchasing` → فواتير الموردين |
| QC hold / inspection workflow (stock held until released) | ⏳ | Phase 5 operations (quality) — today sorting is recorded at receipt |
| Gross / tare / net weighing at the gate | ⏳ | Phase 5 |
| Purchase requisitions (internal request → RFQ/PO) | ⏳ | Not requested yet; RFQs and POs are raised directly by purchasing |
| Supplier returns ↔ debit notes created together | ◐ | a debit note can reference a return document; creating one from the other is manual |
| Purchase price variance into inventory cost / GL | ⏳ | Phase 6 — inventory stays at the PO cost; the variance is recorded on the bill |
| Supplier payments and allocation | ⏳ | Phase 6 (cash/bank) — payable is posted bills − debit notes until then |
| Supplier performance (on-time, rejection rate) | ⏳ | Phase 7 reporting; the data (expected date, receipts, rejections) is captured |

**Phase 4 complete (2026-10-08).** The ⏳ lines belong to the phases named.

## Phase 5 — Operations

| Item | Status | Where |
|---|---|---|
| Preparation queue and assignment: a supervisor assigns, or whoever starts preparing owns it; `?mine=1` queue | ✅ | `assignOrder`, `/api/orders/:id/assign` |
| Picking / prepared quantity, shortage review, loading quantity — the existing order workflow, unchanged | ✅ | `lib/orders-service.ts` |
| Fleet minimum: vehicles (code, plate, type, capacity, refrigerated, active), drivers (name, phone, active) | ✅ | `saveVehicle`, `saveDriver`, `/operations` → العربيات |
| Trips: planned → loading → loaded → dispatched → in transit → completed (cancel before dispatch); TRP- numbers; delivery sequence; capacity check | ✅ | `lib/operations/trips.ts` |
| Trip steps drive each order through its own workflow (no second quantity system); dispatch issues stock exactly as before | ✅ | `startLoading`, `confirmLoaded`, `dispatchTrip` → `moveOrderStatus` |
| Guards: one live trip per order (DB-enforced); loading only prepared orders; leaving only loaded ones; no dispatch, cancel or reopen of a trip order around its trip | ✅ | partial unique index, `liveTripStop` |
| Delivery result (POD) per stop: delivered / shortage / damage / rejection per line, failure with reason, receiver, notes, timestamp; idempotent; DB-balanced and append-only | ✅ | `recordDelivery`, `DeliveryLine` |
| Rejected goods (all goods on a failed delivery) back into quarantine stock on a customer-return document in the same transaction | ✅ | `postCustomerReturnInTx` |
| Invoice on delivered quantity: a trip order is invoiced only after its result; a failed delivery has nothing to invoice | ✅ | `createInvoiceFromOrder`, `ordersToInvoice` |
| Unified operational exceptions (shortage, damage, rejection, delivery failure, loading discrepancy): raised automatically or by hand, owner, resolution, notifications, audit | ✅ | `lib/operations/exceptions.ts`, `/operations` → الاستثناءات |
| Quality inspection / QC hold | ⏳ | Deferred by decision (2026-10-08) |
| Route optimisation, GPS, vehicle maintenance | ⏳ | Not needed yet |
| Dispatch-time stock shortages (strict policy) | ✅ (Phase 2) | `StockIssueException` — kept separate; it is a stock-ledger concern |

**Phase 5 complete (2026-10-08).**

## Phase 6 — Accounting / finance

| Item | Status | Where |
|---|---|---|
| Chart of accounts (seeded, Arabic, system keys for posting rules; sub-accounts can be added) | ✅ | migration `…_accounting_core`, `lib/core/reference-data.ts` |
| Journals: JE- numbers, append-only (DB), balance enforced at commit (DB, deferred), header accounts refused (DB), reversal by a new entry | ✅ | `lib/accounting/ledger.ts` |
| Accounting periods: created on first use, closing locks them (DB trigger refuses postings); closing posts stock valuation first; months close in order | ✅ | `closePeriod` |
| Automatic postings, in the document's own transaction, once per document: invoice, credit note, supplier bill (GRNI + price variance), debit note, receipt, payment | ✅ | `postSalesInvoice` … `postDebitNote`, hooks in `issueInvoice`, `createCreditNote`, `postBill`, `applyBillDecision`, `createDebitNote` |
| Inventory → GL from the stock ledger's valuation layers (receipts ↔ GRNI, issues/returns ↔ COGS, adjustments/scrap/transfers ↔ write-offs), incremental and idempotent | ✅ | `postStockValuation` |
| Customer receipts (RCT-) and supplier payments (PAY-): cash/bank, method, reference; explicit or oldest-first allocation; remainder on account; never over-allocated (service lock + DB check) | ✅ | `lib/accounting/cash.ts` |
| AR and AP now net of receipts/payments: balances, statements, aging (with unapplied money), invoice/bill open amounts, credit exposure | ✅ | `customerReceivable`, `supplierPayable`, statements, aging |
| Cash position; bank reconciliation foundation (tick statement lines, complete at zero difference) | ✅ | `cashPosition`, reconciliations |
| Trial balance, account ledger, journal list/detail | ✅ | `/accounting` |
| Backfill of documents issued before the ledger existed | ✅ | `POST /api/accounting/sync` (idempotent) |
| Egyptian e-invoice (ETA Invoice v1.0): mapper, validation, idempotent submission, status, setup screen | ✅ ready, ⏳ production | `lib/eta/*`, `/eta`. Production needs ETA credentials, the e-seal signing bridge, registered item codes and the accountant's confirmation of the tax classification — see `ETA_EINVOICE.md` §7 |
| UNITED invoice print (own design, Arabic / English, payment state, ETA identifiers) | ✅ | `lib/sales/invoiceDocument.ts`, `/sales/invoices/[id]/print` |
| Supplier-payment approval workflow | ⏳ | Not requested; payments are restricted to `accounting.payments.manage` |
| Inventory revaluation for bill price differences | ⏳ | Variance goes to PPV (5300); per-lot revaluation is a later refinement |

**Phase 6 complete (2026-10-08)** apart from the e-invoice format, which needs the reference.

## Phase 7 — Management reporting

Query-only (no reporting tables): `lib/management/reports.ts`.

| Report | Permission | Source of truth |
|---|---|---|
| Sales, gross margin by product (revenue − actual issue cost), top customers | `reports.finance` (ACCOUNTANT, SUPER_ADMIN) | invoice and credit-note lines, valuation layers of issues/returns |
| Profit and loss | `reports.finance` | posted journal |
| Customer / supplier balances and AR / AP aging | `reports.finance` | invoices, credit notes, receipts; bills, debit notes, payments |
| Inventory valuation, stock movement by kind | `reports.finance` | valuation layers, stock movements |
| Cash position | `reports.finance` | journal (cash/bank accounts) |
| Order fulfilment (required → prepared → loaded → delivered) | `reports.view` (SUPERVISOR) | order lines, delivery lines |
| Preparation performance per preparer (orders, minutes to ready) | `reports.view` | audit trail of status changes |
| Loading and delivery performance (load minutes, dispatch → done, results per driver) | `reports.view` | trips, stops |
| Exceptions by type, open/resolved, time to resolve | `reports.view` | operational exceptions |
| Inventory aging (on hand by lot age) | `reports.view` | stock ledger, lots |

Screens: `/management` (finance), `/management/operations` (operations — quantities and times only, no money).

**Phase 7 complete (2026-10-08).**

## Phase 8 — HR / expenses (minimum)

| Item | Status | Where |
|---|---|---|
| Departments, employees (EMP- codes, job, phone, optional link to a user, active) | ✅ | `lib/hr/service.ts`, `/hr` |
| Expenses (EXP-): account, amount, paid from cash/bank, owed back to the employee, or from the employee's advance; above the threshold → approval engine (`hr.expense`, `hr.expenses.approve`); posted to the ledger when approved | ✅ | `createExpense`, setting `hr.expense_approval_threshold` (500) |
| Advances, reimbursements, advance returns — cash ↔ employee subledger on the journal; never more than owed/held | ✅ | `createEmployeeTransaction` |
| Employee balance and statement read from the journal (party = employee) | ✅ | `listEmployees`, `employeeStatement` |
| Payroll, attendance, leave | ⏳ | Not required now; salaries can be posted as journals to 6300 |
| Expense receipts (photos) | ◐ | the attachment store exists; linking to expenses is a UI step |

**Phase 8 complete (2026-10-08).**

## Phase 9 — Integrations

| Item | Status | Where |
|---|---|---|
| Per-channel keys (n8n, Hermes, …): created once, stored as SHA-256, scoped (`orders.create`, `orders.status`), revocable | ✅ | `lib/integrations/service.ts`, الإدارة → التكاملات |
| Order intake through the one order-creation path: validation, idempotency on `external_id` (DB unique + lock, proven with concurrent retries) | ✅ | `POST /api/orders` |
| Status read-back across the chain (order → trip/delivery → invoice), nothing commercial | ✅ | `GET /api/integrations/orders/:externalId` |
| Append-only integration log of every call (accepted or refused): caller, path, status, external id, result, error, duration; keys never logged | ✅ | `IntegrationLog` |
| Legacy shared `N8N_API_KEY` still accepted (scope `orders.create`, logged as `legacy`) | ✅ | for a non-breaking migration |
| Integration guide for the n8n/Hermes side | ✅ | `docs/erp/INTEGRATIONS.md` |
| ETA e-invoice submission | ⏳ | waits for the accountant's reference invoice |

**Phase 9 complete (2026-10-08).**

## Phase 10 — Hardening

| Item | Status | Where |
|---|---|---|
| Migration chain validated on a fresh database: applies cleanly, zero drift vs schema, seed + permission sync succeed | ✅ | `DEPLOYMENT.md` |
| Commit-time constraint failures surfaced (Prisma interactive transactions otherwise report them as success) | ✅ | `lib/tx.ts` |
| Sign-in lockout in the database (all instances, survives restarts); failed-login record; lockout audited | ✅ | `lib/loginRateLimit.ts`, `LoginAttempt` |
| Indexes for the new hot paths (audit log by time, valuation run watermark, inventory aging by lot) | ✅ | migration `…_hot_path_indexes` |
| Server-error reference ids (response ↔ log line) | ✅ | `handleApiError` |
| Permissions review: generated ROLE × PERMISSION × API × PAGE matrix; every handler × every role tested | ✅ | `RBAC_MATRIX.md`, `tests/security.test.ts` |
| Final browser UAT: 8 roles through the real login, every page, RTL, no overflow, no 5xx | ✅ | — |
| Deployment, backup, restore drill, operating notes | ✅ | `DEPLOYMENT.md` |
| 2FA, password expiry policy, per-device session list | ⏳ | backlog — no current feature depends on them |
| Restore drill on the real Supabase project | ⏳ | **needs the production environment** (owner action) |

## Connected ERP — replacing Odoo (2026-10-08)

Audit of the purchase, sales, inventory and money chains against ten questions per
transaction; full answers in `AUDIT_CONNECTED_FLOWS.md`.

| Item | Status | Where |
|---|---|---|
| Stock valuation posted per stock transaction (movement → entry map), not in batches | ✅ | `postMovementValuation`, `StockValuationPosting` |
| Credit note with goods back / debit note with goods out: stock and money in one transaction | ✅ | `createCreditNote` (`restock`), `createDebitNote` (`return_goods`) |
| Supplier returns credit GRNI by the goods' value, difference to PPV | ✅ | `postDebitNote` |
| Go-live: customer/supplier opening balances (in statements and aging) and opening stock, against opening equity 3300 | ✅ | `/accounting` → الأرصدة الافتتاحية |
| Accounts health: trial balance, unposted documents, orphan entries, AR/AP/inventory vs GL (total and per party) | ✅ | `/accounting` → سلامة الحسابات |
| Control accounts closed to manual journals | ✅ | `createManualJournal` |
| Receipt / payment reversal (bounced cheque, returned transfer) | ✅ | `reverseReceipt`, `reversePayment` |
| Receipts and payments idempotent (double tap, retry) | ✅ | `idempotency_key` |
| Order page shows delivery and invoice state; order timeline fully in Arabic | ✅ | `OrderPricingPanel`, `lib/auditLabels.ts` |
| Navigation grouped by department for multi-department roles | ✅ | `lib/nav.ts`, `components/Nav.tsx` |
| End-to-end business-flow suite (57 checks, green integrity at the end) | ✅ | `tests/flows.test.ts` |
| E-invoice format | ⏳ | Waiting for the accountant's reference invoice |
| Bad-debt write-off document | ⏳ | Credit note meanwhile |

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-10-08 | Existing permission keys are kept; new modules add namespaced keys. | Renaming a key orphans `UserPermissionOverride` rows in production. |
| 2026-10-08 | Settings store only overrides; code holds defaults and bounds. | Adding a setting needs no data migration; "reset" = delete the override. |
| 2026-10-08 | Float → Decimal is its own Phase 2 step, not folded into feature work. | It changes the runtime type of every quantity; it deserves isolated tests. |
| 2026-10-08 | Test suites refuse non-local databases unless explicitly allowed. | The old reset was written against the live database and truncated the stock ledger. |
| 2026-10-08 | Package units (crate, carton, pallet) carry no global ratio. | A crate of mango and a crate of tomatoes weigh differently; that conversion is per product (Phase 2). |
| 2026-10-08 | Codes (company, branch, warehouse, location, unit) are immutable; a unit's category and ratio too. | They will be printed on documents and referenced by ledger rows; changing them rewrites history. |
| 2026-10-08 | Baseline org structure ships in the migration with stable ids (`wh_main`, `loc_cold_1`…). | Phase 2 backfills existing stock movements to the main warehouse without lookups by name. Physical figures are the business's approximations, editable in the admin centre. |
| 2026-10-08 | Segregation of duties for approvals is a setting, default off. | The existing workflow lets a supervisor record and approve a shortage; requiring a second person is a business policy decision. |
| 2026-10-08 | Sequence prefixes are code, not admin-editable. | Invoice numbering continuity matters for the tax authority; a mid-year prefix change breaks it silently. |
| 2026-10-08 | Attachments: Supabase Storage for bytes, PostgreSQL for metadata, behind a `StorageProvider` interface; production never falls back to local disk (503 instead). | Business decision from UNITED; replaceable later without touching ERP logic; a wiped disk must never silently lose documents. |
| 2026-10-08 | Modules read reference lists (units, warehouses) through their own view permission. | A stock controller should not need a master-data grant to pick a unit; the RBAC suite pins STOCK_CONTROLLER to `stock.*` only. |
| 2026-10-08 | Dispatch never blocked by stock by default (`lenient`); short lines become exceptions. `strict` is available. | The truck has left: the books must record reality, not refuse it. Blocking on day one, with intake recording still partial, would stop deliveries. The exception queue makes every gap someone's job to explain. |
| 2026-10-08 | Issued quantity per line = loaded, else prepared, else required. | The last physically confirmed figure is the truest one. |
| 2026-10-08 | Unit cost on receipts is entered and seen only by holders of `stock.valuation.view`. | Price is commercial information; receivers record quantities. Purchasing (Phase 4) will price receipts from the PO. |
| 2026-10-08 | History migrated at cost `unknown` (value 0), reported as such, never invented. | No prices exist for past receipts; a made-up cost would be worse than a visible gap. |
| 2026-10-08 | Two new roles (SALES, ACCOUNTANT) instead of widening SUPERVISOR. | Selling and finance are separate duties from running the floor; credit and invoicing especially must not sit with the person who ships. |
| 2026-10-08 | Order line prices live in their own table, not on `OrderItem`. | Every floor endpoint returns lines as they are; a price column there would leak prices to preparers and loaders. Separation makes that impossible by construction. |
| 2026-10-08 | Prices are dated rows, never edited after use. | Fresh produce prices move daily; "what did this cost on the 3rd" must stay answerable for disputes and audit. |
| 2026-10-08 | Products default to VAT-exempt. | Unprocessed fruit and vegetables are exempt under Egyptian VAT law; taxable items (processed, packaged) are set per product with a reason. **To confirm with UNITED's tax adviser.** |
| 2026-10-08 | Credit control defaults to `warn`, not `block`. | Blocking perishable orders on day one, before limits are entered for every credit customer, would stop deliveries. Finance switches to `block` once limits are in. |
| 2026-10-08 | Auto-reservation defaults to off. | Reserved stock cannot be scrapped or adjusted; with receiving not yet fully recorded, auto-reserving would block stock controllers from writing off spoiled produce. |
| 2026-10-08 | Invoices are drafted by the accountant from a "to invoice" queue, not automatically at dispatch. | Keeps the dispatch transaction lean and puts a human review before a tax document is numbered. |
| 2026-10-08 | Invoiced quantity = loaded (else prepared, else required) until POD exists. | The last physically confirmed figure; Phase 5 POD will credit refused/short quantities. |
| 2026-10-08 | One role per user; "remove a role" means changing it. | The existing model and every guard assume a single role; per-user overrides cover the exceptions without multi-role ambiguity. |
| 2026-10-08 | Users are never deleted, only disabled. | Audit rows, documents and approvals reference them; deletion would orphan history. |
| 2026-10-08 | Admin password reset may force a change at next sign-in (UI default on), but the API default is off. | Integrations and scripts that set passwords keep working; people using the admin screen get the safe default. |
| 2026-10-08 | A PURCHASER role separate from finance; finance (ACCOUNTANT) approves POs above the threshold. | The person who chooses the supplier and price should not also approve the spend. |
| 2026-10-08 | Receipts against a PO take their cost from the PO line; a typed cost is refused. | The receiver does not see prices, and inventory value must follow what was agreed, not what someone typed at the gate. |
| 2026-10-08 | Over-receipt is allowed up to a tolerance (default 10%) on GOOD quantity; rejected quantity never counts. | Fresh-produce weights are never exact; sorted-out produce was not accepted. |
| 2026-10-08 | PO received quantities are derived from posted receipts, never stored. | A corrected or voided receipt can then never leave the order saying something else. |
| 2026-10-08 | Bill matching is judged per line, with the bill taking the worst verdict; default tolerance 1% of the agreed value. | An over-charge on one line must not hide behind an under-charge on another. |
| 2026-10-08 | Bill variances are approved by `purchasing.bills.approve`, held only by SUPER_ADMIN by default — not by the accountant who books the bill. | Segregation of duties regardless of the global "different approver" setting; per-user overrides can delegate it. |
| 2026-10-08 | A receipt on a live bill can no longer be corrected or voided (notes excepted). | The bill was matched against that quantity; changing it afterwards would silently break the match. Cancel the draft bill, or issue a debit note. |
| 2026-10-08 | Inventory is not revalued when the billed price differs from the PO. | Revaluation needs the accounting engine (Phase 6); until then the variance is recorded on the bill, visible and approved. |
| 2026-10-08 | A trip owns no quantities; it moves each order through the existing workflow. | One quantity system: the order lines and the stock ledger. The trip only groups, sequences and guards. |
| 2026-10-08 | Trip dispatch is resumable rather than one transaction across all orders. | Each order's dispatch (with its stock issue) is already one audited transaction; a refused order (strict stock) must not undo the others. Calling dispatch again finishes the rest. |
| 2026-10-08 | At delivery, only goods that physically come back (rejected; everything on a failure) move stock; shortage and damage do not. | They already left with the dispatch issue; moving them again would double-count. They are exceptions to resolve (claim, write-off, credit). |
| 2026-10-08 | Orders on a trip are invoiced on delivered quantity, after the delivery result. | The customer pays for what they accepted; no credit-note round trip for refused goods. Orders dispatched without a trip keep the loaded quantity. |
| 2026-10-08 | Trip planning is a new permission (`operations.trips.manage`, supervisors); loading and dispatch reuse `orders.load` / `orders.dispatch`; exception resolution reuses `orders.approve`. | No duplicate workflow roles: the loader who loads and dispatches orders does the same for a trip. |
| 2026-10-08 | Quality inspection deferred. | Priority is the connected core (operations → accounting); sorting at receipt and delivery exceptions cover today's needs. |
| 2026-10-08 | Each document posts its own journal entry inside its own transaction; unique per source. | The document and its accounting can never disagree; re-running a sync cannot double-post. |
| 2026-10-08 | Inventory reaches the GL from the valuation layers, in incremental runs (and always before a period closes), not from every inventory code path. | The stock ledger stays the single source of truth; no second costing logic. |
| 2026-10-08 | GRNI (2150) bridges receipt and bill: receipts credit it at agreed cost, bills debit it at the same value, differences go to purchase price variance. | Standard perpetual-inventory accrual; inventory is valued when it arrives, not when the bill does. |
| 2026-10-08 | Money received/paid is allocated explicitly or oldest-due first; any remainder stays on account. | Matches how UNITED's customers pay (lump sums, partial payments). |
| 2026-10-08 | `inTx` runs deferred constraints before COMMIT (`SET CONSTRAINTS ALL IMMEDIATE`). | Found in testing: Prisma 5 reports a COMMIT-time failure of an interactive transaction as success (data rolled back silently). Checking before commit makes every violation a thrown error. |
| 2026-10-08 | E-invoice format not guessed. | Waiting for the accountant's reference invoice, per instruction. |
| 2026-10-08 | Expense approval is a separate permission held by SUPER_ADMIN only by default. | The accountant pays and books; someone else approves spend above the threshold. |
| 2026-10-08 | Employees are a third party type on the journal rather than a separate balance table. | One ledger; advances and amounts owed are always consistent with cash. |
| 2026-10-08 | Stock valuation posts inside each stock transaction; the periodic sync is only a catch-up. | Inventory and COGS in the GL must equal the stock ledger at every moment, or margin reports and accounts disagree. The stock ledger stays the only costing logic. |
| 2026-10-08 | Returns move goods and money together when the goods physically move; otherwise the note is a price allowance. | One action, one truth: a credit note for returned goods that left stock unchanged was the commonest way books and warehouse drifted apart. |
| 2026-10-08 | Opening balances are documents (per party, per lot), not a manual journal. | A journal can put a balance in the GL that no statement shows; documents keep statement = ledger from day one. |
| 2026-10-08 | Manual journals cannot post to AR, AP, inventory, GRNI or employee balances. | Those accounts are sums of document ledgers; a manual line would silently break the equality the integrity report proves. |
| 2026-10-08 | Money is corrected by a reversal document, approved by `accounting.manage`, never by editing or deleting the receipt. | Bounced cheques are routine; the history must show both events, and the person recording cash should not be able to make it disappear. |
| 2026-10-08 | Receipts and payments carry a client idempotency key. | Tablets on warehouse Wi-Fi retry; money recorded twice is the most expensive duplicate there is. |
| 2026-10-08 | ETA data lives in a separate compliance layer (`Eta*` tables, `lib/eta`), never as columns on the invoice, customer, product or company. | The core models stay what the business uses; ETA codes are a mapping that can change with ETA's rules without touching invoicing. |
| 2026-10-08 | ETA submission is claimed in its own transaction before any network call; an outcome that may have reached ETA is `unknown` and is never resent until checked. | A duplicate tax document is worse than a delayed one. |
| 2026-10-08 | Nothing ETA-specific is defaulted or guessed: item codes, unit types, branch id and activity code come from ETA registration; missing data blocks submission with a per-field reason. | Per instruction; a guessed code is a wrong tax document. |
| 2026-10-08 | The UNITED invoice keeps its own printed design; ETA identifiers appear on it only once they are facts (submitted / valid / cancelled). | ETA standardises the data, not the layout; customers should never see internal errors. |
| 2026-10-09 | Historical Odoo-replacement UAT (`tests/uat.test.ts`, report `UAT_ODOO_REPLACEMENT.md`): 181 checks over 21 scenarios; readiness 76/100. | Evidence for that run only. It does not certify the current checkout or production readiness; current cutover still needs UNITED data reconciliation, accountant decisions, isolated DB/UAT verification, ETA production setup and a restore drill. |
| 2026-10-09 | Aging counts a credit/debit note on an already-settled document as credit on account. | Aging must equal the statement and the GL; dropping negative open amounts overstated what a party owed. |
| 2026-10-09 | Quarantine stays a business choice (one master-data location); picking excludes quarantine automatically but releases it when the location is named. | Making returns unavailable until inspected changes the warehouse routine; the mechanism is ready, the decision is UNITED's. |
| 2026-10-09 | Stock receipts carry a client idempotency key (one per receiving form); duplicates and retries return the first receipt. | The last stock document without duplicate protection; a timed-out retry must never post stock and GRNI twice. |
| 2026-10-09 | Backup/restore verified by a repeatable drill (`scripts/ops/restore-check.ts`, `BACKUP_RESTORE.md`); cutover verification written (`CUTOVER.md`); readiness report `PRODUCTION_READINESS.md`. | Production readiness rests on evidence that a backup restores to an identical, healthy system and on explicit cutover checks. |
| 2026-10-09 | Sales issues take lots already past expiry last (scrap still first); issuing one notifies stock control; expired stock is not opening stock. | FEFO alone handed customers the expired lot first; for fresh food that is a food-safety and traceability defect. |
| 2026-10-09 | Customer and supplier refunds are documents (`RFD` / `SRF`), limited to the credit the party holds. | A return or overpayment after payment needs money back; reversing a whole receipt misstates the cash book and bank reconciliation. |
| 2026-10-09 | Every document that moves money or stock is created once per form key (credit/debit notes, opening balances and stock, manual journals, expenses, employee transactions join receipts, payments, refunds, stock documents). | A timeout followed by a retry must never post twice. |
| 2026-10-09 | Once an order has a draft or issued invoice, its prices are locked (void the draft / credit note). Costing (standard cost, method) belongs to finance. | The order and its invoice must never silently disagree; valuation is a finance decision. |
| 2026-10-09 | ZERO-500: request faults are 4xx with a message (text-field types, NUL, database rule violations); `tests/robustness.test.ts` fuzzes every handler, role and page. Audit: `SCENARIO_COMPLETENESS_AUDIT.md`. | A "server error" for a correctable request tells the user nothing and hides real failures among false ones. |
