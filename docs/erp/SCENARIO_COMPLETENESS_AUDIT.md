# UNITED ERP — scenario completeness audit

*2026-10-09. System-wide audit of whether UNITED's actual operations contain a material
business scenario the ERP cannot handle correctly. It covers 14 phases: domains, A–Z
scenarios, fresh food, financial integrity, state machines, failure/recovery, RBAC,
master data, reports, migration, Odoo gap, tests and fixes, ZERO-500, scores.*

## Answer

**Readiness verdict (2026-10-09): not production-ready yet.** The codebase has a broad
operational foundation across sales, purchasing, inventory, accounting and delivery,
but this report's historical green-suite totals do not establish production readiness.
Master data is currently empty in the local database, the full PostgreSQL/e2e suites
were not rerun in this review, and the cutover, accounting policy, statutory integration
and restore procedures still need real UNITED data and accountable owners. Treat this
document as a scenario inventory, not a certification that the system can replace Odoo.

**Statutory functions are not replaced.** These stay on the ETA portal (or Odoo), or
are done manually:
- ETA e-invoice submission (built, not production-verified);
- the official VAT return format / filing (the internal period summary is not a statutory submission);
- fixed assets;
- payroll.

None of them is a daily operational flow, but the first two are legal obligations and
need an owner on day one.

## How this audit was run

The counts and outcomes in this section describe the original audit pass. They are
historical evidence, not a current regression certification. The current local checks
are 86 unit tests, TypeScript and an optimized production build; database-backed and
browser end-to-end suites were not rerun for this readiness review.

| Method | What it covered | Result |
|---|---|---|
| **Hostile-input fuzzing** of every API handler (238 handlers, 141 mutations): malformed JSON, wrong types for every field, NUL bytes, 100 KB strings, huge numbers, impossible dates, unknown and real ids, every role, every page | 9,000+ requests | **94 server-error responses on 48 endpoints/pages → 0** |
| **Edge-scenario probes** through the running server, by the real role for each step | ~250 scenarios: fresh food, units, races, illegal transitions, cross-document, master data, IDOR, refunds, retries | **12 defects / gaps found and fixed** (section 12) |
| **Reconciliation** after everything above | GL vs subledgers, stock vs valuation, reports vs GL | Consistent (section 9) |
| **New permanent suites** | `tests/scenarios.test.ts` (92), `tests/robustness.test.ts` (4,560), `tests/integration/expired-lots.test.ts` (5) | All green |
| **Full regression from a fresh reset** after every code change | unit 67, integration 60, e2e 20 suites | All green |

Historical full run reported by the previous audit (not rerun on 2026-10-09):

| Suite group | Checks |
|---|---|
| Unit | 67 |
| Integration (PostgreSQL) | 60 |
| RBAC matrix 247 · Orders 174 · Stock 138 · Product master 108 · Core 107 · Workflow 64 · Documents 38 · Inventory 116 · Sales 193 · Purchasing 125 · Operations 61 · Accounting 50 · HR 22 · Integrations 18 · Flows 57 · ETA 28 · UAT 183 · Security 73 | 1,802 |
| **Scenario completeness (new)** | 92 |
| **ZERO-500 robustness (new)** | 4,560 |
| **Total** | **6,581, 0 failed** |

---

## 1. Domain inventory (from the codebase)

There are 90 data models and 238 API handlers. Every domain below exists in code and has
at least one end-to-end suite.

| Area | Domains (code) | Primary suites |
|---|---|---|
| Identity & control | users, roles (8), 63 permissions, per-user overrides, sessions/revocation, lockout, password lifecycle, audit log, approvals engine, notifications, attachments, settings | rbac, security, core, workflow, documents |
| Master data | company, branch, warehouse, locations (cold rooms, receiving, dispatch, quarantine), units, currencies, products + aliases + packaging, product mapping, customers + aliases + contacts, suppliers + contacts + prices, tax classes, price lists | product-master, core, sales, purchasing |
| Sales | quotations, orders (manual, WhatsApp/integration), credit control, pricing / overrides, invoices, credit notes, customer statement, AR aging, **customer refunds** | orders, sales, flows, uat, scenarios |
| Operations | preparation, shortage/over review, loading, trips, vehicles, drivers, dispatch, delivery result (POD, partial, rejected, damaged, failed), operational exceptions, daily production/report | orders, operations, uat |
| Inventory | stock ledger (append-only), lots + expiry, FEFO/FIFO, reservations, transfers, counts/adjustments + approval, scrap, customer and supplier returns, quarantine, stock-issue exceptions, valuation (AVCO/FIFO/standard), expiring report, opening stock | stock, inventory, integration, scenarios |
| Purchasing | RFQ → quotes → award, PO + approval, receiving (QC, rejection, tolerance, lots), bills (3-way match, variance approval), debit notes, AP aging, supplier statement, **supplier refunds** | purchasing, flows, uat |
| Accounting | chart of accounts, journals (auto + manual), periods + close, receipts / payments + allocation + reversal, refunds, cash position, bank reconciliation, opening balances, trial balance, ledgers, integrity (Accounts Health) | accounting, flows, uat, scenarios |
| HR | departments, employees, expenses + approval, advances, reimbursements, employee statement | hr, uat, scenarios |
| Integrations & ETA | API keys + scopes, inbound orders (idempotent by external id), ETA issuer/receiver/item/unit codes, mapping, validation, submission state machine | integrations, eta |
| Management | finance report (sales, margin, P&L, AR, AP, inventory, cash), operations report, supervisor intelligence | uat, scenarios |

## 2. Scenario classes × domains (covered = an executable check exists)

| Scenario class | Orders/ops | Inventory | Sales/AR | Purchasing/AP | Accounting | HR |
|---|---|---|---|---|---|---|
| Happy path | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Empty / zero / negative / decimals / rounding | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Partial (prep, load, delivery, receipt, payment) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Cancellation / reversal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Duplicate (sequential) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concurrent (burst / race) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Retry after timeout | ✓ | ✓ | ✓ **(new)** | ✓ **(new)** | ✓ **(new)** | ✓ **(new)** |
| Invalid / missing data | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Permission / self-approval | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Closed period | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Already processed (issued / paid / dispatched / returned / billed) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Price change / date change | ✓ **(fixed)** | — | ✓ | ✓ | ✓ | — |
| Cross-document consistency | ✓ **(fixed)** | ✓ | ✓ | ✓ | ✓ | ✓ |

"—" means the class does not apply to that domain.

## 3. Fresh-food scenarios (expected outcome → actual)

| Scenario | Expected business outcome | Actual | Check |
|---|---|---|---|
| Lot expiring **today** | Still sellable today; FEFO takes it first | ✓ | scenarios §1 |
| Lot **expired on the shelf** | Never handed to a customer while a good lot exists; scrap takes it first | **Was the FIRST lot issued to customers (FEFO) → fixed**: last for sales, first for scrap; stock control notified if one is ever issued | integration expired-lots |
| Delivery arriving already expired | Refused at receiving | ✓ 400 | scenarios §1 |
| Expired stock as opening stock | Refused with a reason | **Was a 500 → fixed: 400** | scenarios §1, integration |
| FEFO across several lots / partial lot | Earliest expiry first, splitting lots | ✓ | inventory, uat §1 |
| Lot return / customer return | Back to quarantine if configured, else receiving; at cost | ✓ | uat §7 |
| Damaged / rejected at delivery | Rejected back to stock; damaged an exception; invoice on accepted quantity | ✓ | uat §1, scenarios |
| Failed delivery | All goods back on a return document; no invoice | ✓ | uat §6 |
| Quarantine → release / scrap | Excluded from available and picking; released by transfer/scrap | ✓ | integration quarantine |
| Cold chain | Cold-chain products refuse a dry location | ✓ | integration inventory |
| Shortage at preparation | Flagged; supervisor approval; again at loading (designed) | ✓ | orders, uat §2 |
| Over-preparation (more than ordered) | Flagged for supervisor review | ✓ | probe |
| Over-delivery / over-receipt | PO tolerance; concurrent trucks cannot exceed it | ✓ | scenarios §4 |
| Very small / decimal KG (0.333 kg × 9.99) | Exact to the piastre (3.33) | ✓ | scenarios §1 |
| Units: crates ↔ KG (1.5 × 12.5 kg) | 18.75 kg issued; invoiced per crate; half-crate return 6.25 kg | ✓ | scenarios §2 |
| Substitution | Supervisor edits required quantity with a reason (audited); a different product is a new line | ✓ | orders |
| Price change after quotation | Order keeps the quoted price | ✓ | uat §1 |
| Price change after invoicing | Refused; correction by credit note | **Was silently accepted → fixed (409)** | scenarios §3 |
| Unpriced line | Dispatch allowed (goods left); invoice refused until priced | ✓ | probe |
| Cancelled order / PO | No receipt against a cancelled PO; no invoice for a cancelled order | ✓ | scenarios §5 |
| Wrong quantity received | Edit with reason before billing; after billing → debit note | ✓ | probe, stock |
| Supplier price / invoice mismatch | 3-way match; variance to approval (not the bookkeeper) | ✓ | uat §3 |
| Supplier return after invoice | Debit note with goods out, AP down, PPV | ✓ | uat §8 |
| Customer return **after payment** | Credit note → customer holds credit → **refund** or on account | **Refund was missing → built** | scenarios §9 |
| Supplier return after we paid | Debit note → supplier owes us → supplier refund | **Built** | scenarios §9 |
| Adjustment after financial posting | Count/adjustment posts at today's cost; closed periods locked | ✓ | uat §5, §12 |

## 4. Financial integrity matrix

| Document | Operational effect | Stock | Subledger | GL entry | Tax | Reversal path |
|---|---|---|---|---|---|---|
| Stock receipt | PO progress | + lot | GRNI | Dr 1400 / Cr 2150 | — | void before billing; debit note after |
| Dispatch | order out | − FEFO lots | — | Dr 5100 / Cr 1400 | — | reopen (reverses the issue at its cost) before invoicing |
| Delivery result | stop closed | + rejected / failed back | — | Dr 1400 / Cr 5100 | — | exception workflow |
| Sales invoice | order invoiced | — | AR + | Dr 1300 / Cr 4100 / Cr 2200 | VAT out | credit note (never void after issue) |
| Credit note | — | + if restocked | AR − | Dr 4200 / Dr 2200 / Cr 1300 (+ stock at cost) | VAT out − | none (a new invoice) |
| Customer receipt | invoices settled | — | AR − | Dr cash / Cr 1300 | — | receipt reversal |
| **Customer refund** | credit paid out | — | AR + (≤ credit) | Dr 1300 / Cr cash | — | a receipt |
| Supplier bill | receipts billed | — | AP + | Dr 2150 (+ PPV) / Cr 2100 (+ VAT in) | VAT in | debit note; cancel before posting |
| Debit note | — | − if goods returned | AP − | Dr 2100 / Cr 1400 / 5300 | VAT in − | none |
| Supplier payment | bills settled | — | AP − | Dr 2100 / Cr cash | — | payment reversal |
| **Supplier refund** | credit paid back | — | AP + (≤ credit) | Dr cash / Cr 2100 | — | a payment |
| Transfer | location change | ± same cost | — | none | — | reverse document |
| Count / scrap | variance | ± | — | Dr/Cr 5200 / 1400 | — | reverse document |
| Expense | — | — | employee balance (if not cash) | Dr 6xxx / Cr cash or 2300 / 1600 | — | rejection before posting |
| Employee advance / reimbursement | — | — | employee balance | Dr 1600 or 2300 / Cr cash | — | advance return |
| Opening balance / stock | go-live | + lots | AR / AP | against 3300 | — | a counter-entry |
| Manual journal | — | — | refused on control accounts | as entered | — | journal reversal |

**No orphan state.** The integrity report checks the following, and passed after the
full suite and every probe:
- every document has its entry, and every entry has its document;
- the trial balance is balanced;
- AR = GL 1300 and AP = GL 2100, in total and per party (refunds included);
- inventory valuation = GL 1400.

## 5. State machines (illegal transitions tested)

| Document | Refused (tested) |
|---|---|
| Order | Skipping steps without an override reason; unknown status; backward moves by floor roles; loading while preparing; preparing after "ready"; dispatching twice; cancelling a dispatched order; reopening an invoiced order (credit note first); pricing after invoicing |
| Invoice | Issuing twice; voiding an issued one; credit note on a draft; crediting more than invoiced (also under a 3× race) |
| Bill | Billing a receipt twice (also under a race); duplicate supplier invoice number (case/space-insensitive); debit note beyond billed (also under a race); voiding or editing a billed receipt |
| PO | Receiving on a draft, cancelled or closed PO; sending an unsubmitted one; submitting twice; cancelling a received one |
| RFQ / quotation | Quoting or sending a cancelled RFQ; converting / accepting a draft or cancelled quotation; an expired validity date |
| Trip / stop | Dispatching twice (version conflict); a second, different delivery result; cancelling a dispatched trip |
| Receipt / payment / journal | Reversing twice; allocating a reversed receipt; allocating to another party's document; unbalanced, one-line, both-sides, 3-decimal or header-account journals |
| Approval | Self-approval (count, bill variance, expense); two concurrent decisions → exactly one wins (version guard) |
| Period | Closing out of order; any posting into a closed period |

## 6. Failure and recovery

| Failure | Outcome | Mechanism |
|---|---|---|
| DB error / crash mid-request | Rolled back | Every mutation is one transaction (`inTx`); ledgers and journals are append-only; the journal balance is checked at commit |
| Timeout / closed browser / lost network, then retry | Retryable, no double posting | One key per filled form: stock receipts, inventory documents, receipts, payments, refunds, **credit notes, debit notes, opening balances, opening stock, manual journals, expenses, employee transactions (new)**. Invoices from orders are naturally idempotent |
| Double tap / concurrent identical submits | One document | Advisory lock on the key + unique index; replay returns the first |
| Concurrent different submits on the same balance | Never over-allocated | Per-party / per-document locks; DB allocation cap; bucket non-negative constraint |
| ETA timeout after the request left | Unknown → reconcile | `unknown` state, resolved only by refresh/reconcile, never by resending |
| Attachment storage OK, DB write fails | Rolled back | The uploaded blob is removed (compensation) |
| Server restart | Committed or rolled back | Stateless servers; sessions are signed tokens |

The earlier low-severity note about inventory idempotency payload mismatches is stale:
new inventory documents persist a canonical request fingerprint and reject reuse of a
key with a different payload (409). Historical rows without a fingerprint retain
legacy replay behavior. Unit coverage was added; the PostgreSQL integration suite was
not run in this review.

## 7. RBAC

- **Every handler × every role.** The security suite is generated from code: every
  handler is called by every role that lacks its permission, and anonymously; all are
  refused. 36 named cross-role attacks in the UAT; IDOR checks for allocation to another
  party, credit-note lines of another invoice, other users' notifications and hidden
  fields.
- **Field-level redaction.** The floor never sees prices or costs.
- **Found and fixed:** the stock controller could write a product's standard cost and
  costing method (valuation is finance's). These now need `accounting.manage`; handling
  fields still need `stock.manage_products`.
- **Silent field drops (LOW, safe).** A role without the right permission that sends
  restricted fields (for example credit terms by sales) gets 200 with the fields ignored.
  The control holds, but the API is silent.

## 8. Master data integrity

| Bad data | Result |
|---|---|
| Product without a unit / unknown unit | 400, actionable |
| Duplicate product name (case, spaces), duplicate SKU | 409 |
| Product defaults | Exempt tax, AVCO, FEFO (never a silent missing tax class) |
| Duplicate customer tax number / name, duplicate supplier | 409 |
| Inactive customer | No new orders; payments still accepted (collections continue); refunds allowed |
| Inactive product | No receiving |
| Unknown location / cash account / party | 400 / 404 |
| Missing credit terms | Treated as a cash customer; finance sets terms |
| Any wrong type or hostile value on any field | 4xx with a message (ZERO-500 suite) |

## 9. Report reconciliation

| Report | Reconciled against | Status |
|---|---|---|
| Trial balance | Itself (debit = credit) | ✓ |
| AR aging, customer statement | GL 1300, per customer (integrity) and aging = statement | ✓ including refunds and credit held from opening advances |
| AP aging, supplier statement | GL 2100, per supplier | ✓ including refunds |
| Stock on hand / valuation | Stock ledger sum = valuation quantity; valuation = GL 1400 | ✓ (piastre rounding per posting, within tolerance) |
| Sales revenue (management) | P&L revenue from the GL (4100 − 4200) | ✓ exact |
| Cost of sales (management) | GL COGS 5100 | ✓ within per-posting piastre rounding (0.02 EGP over the whole test dataset) |
| Cash position | GL cash/bank accounts (read from the GL) | ✓ by construction |

There is no silent exclusion. Credit notes on paid invoices, unallocated receipts and
refunds all appear in the aging (the aging fixes from the UAT plus the refund handling
in this pass).

## 10. Data-migration readiness (CSV import available; Odoo cutover still unverified)

| Data | Representable | What does not migrate cleanly |
|---|---|---|
| Customers, suppliers, products, product tax code, dated sales/supplier prices | Yes | CSV/XLSX import with preview or manual cards. Customer credit terms/holds and price-list assignment are included with finance/pricing permissions; price lists must exist first. |
| Product settings and packaging | Yes | Separate SKU-based CSV/XLSX templates load per-product package conversions, barcode, shelf life, costing, cold-chain, removal strategy and stock levels; costing rows require finance permission |
| Contact profiles and ETA identifiers | Yes in the setup screens | Not included in the CSV templates; enter and verify them in their dedicated screens |
| Odoo exports | Partial | XLSX upload works when columns match a provided template; direct Odoo column mapping and reconciliation against source reports remain |
| Stock and lots | Yes: opening stock per product/lot/expiry/location at cost, idempotent | Lot *history*; lots already expired (refused: scrap them in Odoo first) |
| AR / AP | Yes: opening balances per party or per open document, with due dates; idempotent | Historical invoice lines and partial-payment history (only the open amount carries) |
| Open sales orders / POs | Re-entered (not migrated as documents) | Odoo document numbers (keep them in the reference field) |
| Customer advances / supplier debit balances | Yes: negative opening balances, refundable | — |
| Historical invoices | References only (opening balance reference) | ETA UUIDs of historical invoices stay in Odoo |
| Cash / bank / capital | One manual journal | — |
| GRNI | Not carried | Settle in Odoo before cut-off, or carry as the supplier's opening balance |

## 11. Odoo gap analysis

| Class | Capabilities |
|---|---|
| **A — Stronger than Odoo for UNITED** | Shortage/over review with supervisor approval; floor-role redaction of prices/costs; segregation of duties in approvals; append-only ledgers enforced in the database; per-party AR/AP vs GL integrity screen; one-key retry safety on every money and stock document; FEFO that never sells an expired lot while a good one exists; delivery-result-driven invoicing; WhatsApp/integration orders idempotent by external id; Arabic-first tablet UI |
| **B — Equivalent** | Quotations, sales orders, invoicing, credit notes, customer statements/aging, refunds; RFQ → PO → receipt → bill (3-way match), debit notes; lots/expiry, transfers, counts, scrap, quarantine, valuation (AVCO/FIFO/standard); journals, periods, reconciliation, trial balance, P&L; expenses, advances |
| **C — Missing but required (blocker)** | **None for daily operations.** Customer/supplier refunds were the one C item found, and they were built in this pass |
| **D — Not required by UNITED's business** | Manufacturing/MRP, POS, e-commerce, multi-company consolidation, landed costs, analytic accounting, subscriptions |
| **E — Future / statutory (stays on Odoo, the portal or manual)** | ETA e-invoice submission (built, needs credentials, signing and SDK verification); official VAT return format / filing (internal period summary now reconciles to tax GL accounts); fixed assets and depreciation; payroll; direct Odoo XLSX mapping and contact/ETA identifiers; second warehouse with inter-warehouse transfer |

## 12. Defects and gaps found in this audit, all fixed with regression checks

| # | Finding | Impact | Severity | Fix |
|---|---|---|---|---|
| 1 | A sale (dispatch) issued **expired lots first** (FEFO sorts by expiry, nothing excluded expired lots) | Expired produce attributed to customers; books wrong by lot; expiry report hides real waste | **HIGH** | Expired lots last for sales; notification when one is issued; product pick order agrees; scrap unchanged |
| 2 | Credit notes, debit notes, opening balances, manual journals, expenses, employee cash transactions, opening stock were **not retry-safe** | A timeout + retry posted twice: double credit, double cash advance, doubled opening balance at cutover | **HIGH** | One key per form, replay, 409 on mismatch; additive migration |
| 3 | **No refund** for a customer who returned goods after paying (or a supplier after we paid) | The only path was reversing a whole receipt, which misstates the cash book and breaks bank reconciliation | **HIGH (missing capability)** | Customer and supplier refunds, limited to the credit held, in every balance, statement, aging and integrity check |
| 4 | Order prices editable after a draft or issued invoice | The order and its invoice silently disagree; a price changed during a draft was ignored at issue | MEDIUM | 409 with the correction path |
| 5 | Stock controller could set standard cost / costing method | Valuation changed outside finance | MEDIUM | Costing fields need `accounting.manage` |
| 6 | 94 triggerable 500s on 48 endpoints/pages (non-text fields on `.trim()`, NUL bytes, wrong-shaped ids, CHECK/FK violations, bad dates, unknown invoice print) | "Server error" instead of a correctable message | MEDIUM | `asText`, NUL refusal, client-fault mapping, validations; robustness suite |
| 7 | Expired opening stock → 500 | Cutover entry fails without a reason | MEDIUM | 400 with the reason |
| 8 | zod's English "Required" | Unclear message | LOW | Arabic message naming the field |

## 13. ZERO-500

- **Before:** 94 server-error responses from hostile but ordinary input, on 48 endpoints and pages.
- **After:** 0 across:
  - 1,380 hostile mutations, 384 hostile reads, every role's refusal path, and 464 page
    loads (every page × role × hostile query) — `tests/robustness.test.ts`, ~4,560 checks;
  - all designed refusals: 400 / 403 / 404 / 409 / 422 with a message.
- **Remaining by design:** ETA endpoints answer **503** while ETA is not configured
  (service unavailable).
- **Unknown errors** still return 500 with a reference, so real bugs stay visible.

---

## 14. Scores, blockers, decisions

### 14.1 Scores (not inflated)

| Area | Score | Why not higher |
|---|---|---|
| Business coverage (daily operations) | 90 | Historical score: single warehouse; CSV now covers masters, product settings/packaging, dated prices and opening balances/stock; direct Odoo column mapping remains |
| Scenario coverage | 88 | Long-tail timing scenarios (expiry crossing midnight mid-trip) are covered by rule, not by an end-to-end clock test |
| Test coverage | 90 | 6,581 checks; no browser-level UI test suite (only render/permission sweeps) |
| Accounting integrity | 93 | AVCO vs FIFO and tax subtypes await the accountant |
| Inventory integrity | 90 | Historical score: expired stock availability was identified and fixed; database-backed expiry scenarios were not rerun in this review |
| Security | 92 | Silent field drops; no MFA |
| Recovery / retry | 90 | Historical score: current inventory document idempotency checks reject a reused key with a changed payload; database-backed concurrency tests were not rerun in this review |
| Report reconciliation | 90 | COGS report vs GL equal only to per-posting rounding |
| ETA | 45 | Not production-verified (credentials, signing, SDK) |
| **Overall (daily operations)** | **89** | — |

### 14.2 Final blockers

**CRITICAL** — none.

**HIGH** (before or at go-live; none is an ERP defect):
1. **ETA submission is not production-verified.** E-invoices are submitted through the
   ETA portal (or Odoo) for invoices issued in UNITED until it is. This is a legal
   obligation from day one, so name an owner.
2. **The production restore drill has not been performed** (`BACKUP_RESTORE.md`). Enable
   point-in-time recovery and off-site dumps.

**MEDIUM** (operate with awareness, or decide):
1. Expired stock is excluded from sale availability and picking by business date in
   the current code. The PostgreSQL expiry scenarios were not rerun in the 2026-10-09
   review. Scrap expired lots through the expiring report.
2. Count adjustments post without approval (threshold 0 = off), and scrap has no approval
   step. Set `inventory.adjustment_approval_threshold` before go-live.
3. Future-dated receipts, payments, expenses and manual journals are accepted (post-dated
   cheques are common; refunds already refuse future dates). The accountant decides
   whether to restrict them.
4. A shortage is approved twice (preparation and loading) — the designed rule.
5. Quarantine for returns is a configuration decision (one location).
6. Closing a period cannot be undone. Close deliberately: no reopen exists.

**LOW / review items**
1. Silent drop of fields the caller has no permission for.
2. Delivery results now require a reason for delivered-stop shortages, damage, and
   rejected quantities. Unit regression checks were added; database-backed scenarios
   were not rerun in this review.
3. Order quantities now reject more than three decimal places or values above 999,999,999,999; database-backed order scenarios were not rerun in this review.
4. Credit held from a credit note on a paid invoice nets in the statement and aging, but
   cannot be allocated to a specific new invoice. Refund it, or let it offset.
5. Foreign currencies are now rejected by supported master-data APIs, posting guards,
   and database checks. Historical non-EGP records must be reconciled explicitly before
   validating the `NOT VALID` constraints in another database.

### 14.3 Decisions for management and the accountant

1. Costing method (AVCO default).
2. Tax recognition basis: the current summary uses invoice/bill dates; cash-basis tax
   adjustments are not implemented.
3. Purchase-price difference policy: current bill variances post to PPV (5300), with no
   individual-lot revaluation.
4. ETA tax subtypes.
5. Quarantine.
6. Shortage double approval.
7. Adjustment approval threshold.
8. Credit control mode (`warn` default, or `block`).
9. Future-dated postings.
10. Cut-off rules.
11. Opening trial balance sign-off.

### 14.4 What changed in this pass

- **Migrations (additive):** `…_party_refunds`, `…_money_document_idempotency`.
- **New endpoints:** `/api/accounting/customer-refunds`, `/api/accounting/supplier-refunds`
  (GET `accounting.view`; POST `accounting.payments.manage` / `accounting.receipts.manage`).
- **Changed gate:** `PATCH /api/inventory/products/[id]/settings` (stock *or* finance; per
  field).
- **UI:** a refund panel under التحصيل / السداد; every money form sends one key per
  filled form.
- **Unchanged:** no existing test was weakened. One integration test now uses a finance
  actor for the costing-method rule it asserts, because that rule moved to finance.

### 14.5 Current review (2026-10-09)

- Enforced EGP-only currency entry for company base currency, suppliers, and price lists;
  guarded purchasing, quotation, invoice, and ledger posting paths against legacy FX.
- Added database checks for all currency-bearing business documents. Applied locally
  after a read-only scan found zero non-EGP rows; migration uses `NOT VALID` so another
  database with historical FX rows can deploy without silently rewriting old amounts.
- Fixed inventory idempotency to return 409 when an idempotency key is reused with a
  different request payload.
- Added delivery-result reasons for shortage, damage, and rejection quantities.
- Added replenishment suggestions from ledger availability and min/max rules; user
  explicitly selects lines and suppliers before creating an RFQ draft.
- Initial data loading supports manual cards plus CSV/XLSX preview/import (first sheet)
  for customers, suppliers, products, settings, packaging, dated prices, opening stock
  and balances.
- Added an internal VAT-period summary by tax code/rate, net of credits/debits and
  reconciled against tax control accounts; it does not file statutory returns.
- Removed the build-time Google Fonts fetch so production builds work without network
  access; Arabic uses local system-font fallbacks.
- Verified in the current review: TypeScript check passed, unit suite 86/86 passed, and
  optimized production build completed from a temporary copy.
- Not verified here: PostgreSQL integration/e2e suites, browser-wide screen coverage,
  accounting reconciliation on populated UNITED data, production ETA submission, and
  backup/restore. A later read-only check could not connect to PostgreSQL on
  `localhost:5432`, so the previously observed 0 customers and 0 products are not current.
