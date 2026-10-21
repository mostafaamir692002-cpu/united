# UNITED ERP — COMPREHENSIVE REQUIREMENTS, FEATURE & UI/UX GAP AUDIT

**Date:** 2026-10-18 | **Status:** AUDIT ONLY — no deployment, no pilot, no publication  
**Repository:** `/opt/data/united-investigation` · `united-full-project` @ `7bccad7425…a103`  
**Environment:** 52 modified, 39 untracked, 0 staged, dev server healthy, DB `united_test@localhost:5433`

---

## 1. EXECUTIVE SUMMARY

### What is genuinely complete

The system is a **functioning ERP** for UNITED's daily operations. All core business workflows — sales orders, dispatch, invoicing, purchasing, stock intake, grading, returns, accounting, and reporting — are implemented and proven by the canonical test chain (6,624+/0 assertions across 21 suites in a single fresh run).

### What is incomplete

| Area | Status | Impact |
|---|---|---|
| UI/UX — comprehensive human usability | **NOT TESTED** | Staff may find flows misaligned with mental models |
| Arabic/RTL — edge cases (number formatting, printing, mixed text) | **PARTIAL** | Automated checks pass; human verification not done |
| Tablet/mobile — warehouse workflows | **NOT TESTED** | Layout is responsive; no device testing |
| Performance / load | **NOT MEASURED** | Unknown headroom under concurrent staff use |
| ETA live submission | **NOT VERIFIED** | Legal requirement — bridge+sandbox not exercised |
| Payroll | **NOT IMPLEMENTED** | Only employee expenses exist |
| Staff human UAT | **NOT RUN** | No sign-off from actual warehouse/sales/accounting staff |

---

## 2. FULL ORIGINAL-REQUIREMENTS TRACEABILITY MATRIX

### 2.1 Business Operations — Sales

| ID | Requirement | Source | Route/Service | Test | Verdict |
|---|---|---|---|---|---|
| SAL-01 | Customer master with aliases, contacts, credit mgmt | ASSESSMENT.md, ROADMAP | `sales/customers/*`, `components/sales/CustomersView.tsx` | sales 193/0 | VERIFIED |
| SAL-02 | Price lists with dated prices | ROADMAP Phase 3 | `sales/price-lists/*`, `components/sales/PriceListsView.tsx` | sales 193/0 | VERIFIED |
| SAL-03 | Quotation → order conversion | ROADMAP Phase 3 | `sales/quotations/*/convert` | UAT §1, sales 193/0 | VERIFIED |
| SAL-04 | Order state machine (7 statuses) | ROADMAP Phase 1 | `orders/*`, `components/order/OrderDetail.tsx` | orders 175/0 | VERIFIED |
| SAL-05 | Preparation board (Tablet 1) | ROADMAP Phase 1 | `app/prep/page.tsx`, `components/prep/PrepBoard.tsx` | UAT §2, orders 175/0 | VERIFIED |
| SAL-06 | Loading board (Tablet 2) | ROADMAP Phase 1 | `app/load/page.tsx`, `components/load/LoadBoard.tsx` | UAT §2, orders 175/0 | VERIFIED |
| SAL-07 | Sales invoicing from orders | ROADMAP Phase 3 | `sales/invoices/*/issue`, `lib/sales/invoicing.ts` | UAT §16, sales 193/0 | VERIFIED |
| SAL-08 | Credit notes with per-line invoice cap | ROADMAP Phase 3, FIXED | `sales/invoices/*/credit-notes`, `invoicing.ts` | returns-integrity 27/0 | VERIFIED |
| SAL-09 | Customer statements and AR aging | ROADMAP Phase 3 | `sales/customers/*/statement`, `sales/reports/aging` | accounting 50/0 | VERIFIED |
| SAL-10 | Customer refunds | Scenario audit FIX | `accounting/customer-refunds` | scenarios §9 | VERIFIED |

### 2.2 Business Operations — Purchasing

| ID | Requirement | Source | Route/Service | Test | Verdict |
|---|---|---|---|---|---|
| PUR-01 | Supplier master with contacts, prices | ROADMAP Phase 4 | `purchasing/suppliers/*` | purchasing 125/0 | VERIFIED |
| PUR-02 | RFQ → Quote → Award → PO workflow | ROADMAP Phase 4 | `purchasing/rfqs/*`, `purchasing/orders/*` | purchasing 125/0 | VERIFIED |
| PUR-03 | PO lifecycle + approval | ROADMAP Phase 4 | `purchasing/orders/*`, `lib/core/approvals.ts` | purchasing 125/0 | VERIFIED |
| PUR-04 | 3-way matching: PO × Receipt × Bill | ROADMAP Phase 4 | `purchasing/bills`, `lib/purchasing/bills.ts` | UAT §3 | VERIFIED |
| PUR-05 | Supplier bills with GRNI/PPV posting | ROADMAP Phase 4 | `purchasing/bills/*/post` | UAT §3, cost-reconciliation 21/0 | VERIFIED |
| PUR-06 | Debit notes | ROADMAP Phase 4 | `purchasing/bills/*/debit-notes` | UAT §8, purchasing 125/0 | VERIFIED |
| PUR-07 | Supplier statements and AP aging | ROADMAP Phase 4 | `purchasing/suppliers/*/statement`, `purchasing/reports/ap-aging` | accounting 50/0 | VERIFIED |
| PUR-08 | Supplier refunds | Scenario audit FIX | `accounting/supplier-refunds` | scenarios §9 | VERIFIED |
| PUR-09 | Supplier return — cumulative cap ≤ received | SESSION FIX | `lib/inventory/documents.ts` | returns-integrity 27/0 (§5) | VERIFIED |

### 2.3 Business Operations — Stock / Inventory

| ID | Requirement | Source | Route/Service | Test | Verdict |
|---|---|---|---|---|---|
| STK-01 | Stock intake with sorting/rejection grading | ROADMAP Phase 2 | `stock/intakes/*`, `lib/stock-service.ts` | stock 148/0 | VERIFIED |
| STK-02 | Grade B (فرزة) separate tracking | SESSION REQUEST | `intakes/route.ts` (grade_b_qty forwarded), `loc_grade_b` | stock 148/0 (§5b) | VERIFIED |
| STK-03 | Waste (هالك) tracking | SESSION REQUEST | `intakes/route.ts` (waste_qty forwarded) | stock 148/0 (§5b) | VERIFIED |
| STK-04 | Append-only StockMovement ledger | ROADMAP Phase 2 | `lib/stock-service.ts`, DB triggers | inventory 119/0 | VERIFIED |
| STK-05 | Stock valuation (AVCO/FIFO/standard) | ROADMAP Phase 2 | `lib/inventory/ledger.ts` | inventory 119/0 | VERIFIED |
| STK-06 | Stock adjustments with approval | ROADMAP Phase 2 | `stock/adjustments`, `lib/core/approvals.ts` | UAT §5 | VERIFIED |
| STK-07 | Warehouse transfers | ROADMAP Phase 2 | `stock/inventory`, `components/stock/inventory/MoveForms.tsx` | inventory 119/0 | VERIFIED |
| STK-08 | Negative stock prevention | ROADMAP Phase 2 | DB CHECK + bucket lock | inventory 119/0 | VERIFIED |
| STK-09 | Product master with aliases, packaging, units | ROADMAP Phase 2 | `stock/products/*`, `components/stock/master/*` | product-master 108/0 | VERIFIED |
| STK-10 | Supplier management (stock side) | ROADMAP Phase 2 | `stock/suppliers/*` | stock 148/0 | VERIFIED |
| STK-11 | Duplicate receipt prevention (idempotency) | Session HARDENING | `lib/stock-service.ts` — idempotency key | integration stock-receipt-idempotency | VERIFIED |
| STK-12 | FEFO picking (expired lots last) | Scenario audit FIX | `lib/stock-service.ts` | integration expired-lots | VERIFIED |
| STK-13 | Quarantine location for returns | Scenario audit | `lib/inventory/ledger.ts` | integration quarantine-release | VERIFIED |

### 2.4 Business Operations — Accounting

| ID | Requirement | Source | Route/Service | Test | Verdict |
|---|---|---|---|---|---|
| ACC-01 | Chart of accounts (27+ accounts with system keys) | ROADMAP Phase 6 | `accounting/accounts/*`, lib | accounting 50/0 | VERIFIED |
| ACC-02 | Double-entry journal (balanced, append-only) | ROADMAP Phase 6 | `accounting/journals/*`, `lib/accounting/ledger.ts` | accounting 50/0 | VERIFIED |
| ACC-03 | Period control (open/close, sequential) | ROADMAP Phase 6 | `accounting/periods/*/close` | UAT §19, accounting 50/0 | VERIFIED |
| ACC-04 | Manual journals with reversal | ROADMAP Phase 6 | `accounting/journals/*/reverse` | UAT §14 | VERIFIED |
| ACC-05 | Customer receipts with allocation | ROADMAP Phase 6 | `accounting/receipts/*` | UAT §18 | VERIFIED |
| ACC-06 | Supplier payments with allocation | ROADMAP Phase 6 | `accounting/payments/*` | UAT §18 | VERIFIED |
| ACC-07 | Payment reversal (bounced cheque) | ROADMAP Phase 6 | `accounting/receipts/*/reverse` | flows 57/0 | VERIFIED |
| ACC-08 | Bank reconciliation | ROADMAP Phase 6 | `accounting/reconciliations/*` | accounting 50/0 | VERIFIED |
| ACC-09 | Stock valuation posting to GL | ROADMAP Phase 6 | `accounting/stock-valuation` | accounting 50/0 | VERIFIED |
| ACC-10 | Trial balance | ROADMAP Phase 6 | `accounting/trial-balance` | accounting 50/0 | VERIFIED |
| ACC-11 | P&L and balance sheet | ROADMAP P2 (now ✅) | `accounting/pnl`, `accounting/balance-sheet` | accounting 50/0 | VERIFIED |
| ACC-12 | EGP-only enforcement | ROADMAP Phase 6 | DB CHECK, API guards, posting validation | scenarios | VERIFIED |
| ACC-13 | Idempotent document processing | ROADMAP Phase 6 | `lib/core/idempotency.ts` | db-constraints 10/0 | VERIFIED |

### 2.5 Previously Requested Additions

| ID | Requirement | Source | Implementation | Test | Verdict |
|---|---|---|---|---|---|
| ADD-01 | Produce grading (good/Grade B/waste) tracked separately | Multiple sessions | `intakes/route.ts` (+grade_b_qty, +waste_qty), `loc_grade_b`, `loc_waste` | stock 148/0 | VERIFIED |
| ADD-02 | P&L and balance sheet aggregation | ROADMAP P2 → ✅ | `accounting/pnl`, `accounting/balance-sheet` | accounting 50/0 | VERIFIED |
| ADD-03 | Picking sheet and consolidated picking | SESSION REQUEST | `app/production/sheet/`, `components/production/PickingSheet.tsx` | picking-sheet 29/0 | VERIFIED |
| ADD-04 | Supervisor rejection with reason capture | ROADMAP Phase 5 | `order/[id]/status` with reason | UAT §2 | VERIFIED |
| ADD-05 | Draft persistence | ROADMAP Phase 4 | All documents — draft state in state machines | state machine tests | VERIFIED |
| ADD-06 | CSV exports | SESSION REQUEST | `/export` routes for customer/supplier statement, finance, valuation | exports 16/0 | VERIFIED |
| ADD-07 | VAT summary | ROADMAP P2 | `accounting/vat-summary`, `accounting/vat-summary/export` | accounting 50/0 | VERIFIED |
| ADD-08 | Quarantine workflow for returns | Scenario audit | `lib/inventory/ledger.ts` — quarantine location | integration quarantine-release | VERIFIED |
| ADD-09 | Opening balances (customer/supplier/stock) | ROADMAP Phase 9 | `accounting/opening-balances`, `accounting/opening-stock` | accounting 50/0 | VERIFIED |
| ADD-10 | Stock valuation & accounting reconciliation | ROADMAP Phase 6 | `accounting/integrity`, Accounts Health check | accounting 50/0 | VERIFIED |
| ADD-11 | Cancellation reports + safe reversal | ROADMAP P2 → ✅ THIS SESSION | `accounting/cancelled-report/route.ts` | cancelled-report 15/0 | VERIFIED |
| ADD-12 | Per-product return limits (cumulative physical cap) | VANTA session | `lib/inventory/documents.ts` | returns-integrity 27/0 (§5) | VERIFIED |
| ADD-13 | Unit normalization for return caps (toBaseQuantity) | THIS SESSION FIX | `lib/sales/invoicing.ts` | returns-integrity 27/0 | VERIFIED |
| ADD-14 | Unknown-cost intake → sale flagged → bill transition | VANTA session | `lib/management/reports.ts` (costUnknownQty), `bills.ts` | cost-reconciliation 21/0 | VERIFIED |

### 2.6 Previously Identified Partial Odoo Capabilities

| ID | Capability | Source | Status | Verdict |
|---|---|---|---|---|
| ODOO-01 | Periodic waste write-off | PRODUCTION_READINESS.md §H | **PARTIAL** — waste enters at cost in `loc_waste`; explicit scrap needed to write off | BLOCKED BY BUSINESS DECISION |
| ODOO-02 | Packaging (crate↔KG) | ASSESSMENT.md | **IMPLEMENTED** — `ProductPackaging`, `lib/inventory/packaging.ts`, `toBaseQuantity` | VERIFIED |
| ODOO-03 | Discount / price override | SALES flow | **IMPLEMENTED** — order pricing panel, credit line discounts | VERIFIED (sales 193/0) |
| ODOO-04 | Grade B as separate SKU | Multiple sessions | **NOT IMPLEMENTED** — blended COGS through location separation; independent SKU needs product-identity decision | BLOCKED BY BUSINESS DECISION |
| ODOO-05 | Fixed assets and depreciation | PRODUCTION_READINESS.md §H | **NOT IMPLEMENTED** — explicitly out of scope (stays on Odoo or manual) | DEFERRED |
| ODOO-06 | Multi-currency | PRODUCTION_READINESS.md §I | **IMPLEMENTED but blocked** — EGP-only enforced; historical FX rows refused | VERIFIED (EGP-only, correctly) |

---

## 3. FEATURE-BY-FEATURE IMPLEMENTATION AUDIT

### 3.1 Core Business Features — Present and VERIFIED

All 14 core domains from the ROADMAP (Phases 1-10) are implemented and tested:
- ✅ Order lifecycle (7 states)
- ✅ Stock intake with grading
- ✅ Sales: quotation → order → invoice → credit note
- ✅ Purchasing: RFQ → PO → receipt → bill → debit note
- ✅ Operations: trips, vehicles, drivers, delivery recording
- ✅ Accounting: double-entry, trial balance, P&L, balance sheet, periods
- ✅ HR: employees, expenses, advances
- ✅ ETA e-invoicing pipeline
- ✅ Data onboarding (CSV/XLSX import)
- ✅ RBAC with 80+ permissions
- ✅ Approval engine
- ✅ Notifications, audit log, attachments
- ✅ Rate limiting, session management, idempotency
- ✅ Login/password management

### 3.2 Features Partially Implemented

| Feature | What exists | What's missing | Impact | Verdict |
|---|---|---|---|---|
| **Grade B costing** | Location-separated tracking at blended AVCO | No independent SKU for separate costing | Margin analysis blended; operational but imprecise | BLOCKED (decision) |
| **Waste write-off** | Waste enters `loc_waste` at cost | No periodic auto-write-off; must be manually scrapped | Waste accumulates in stock unless explicitly scrapped | BLOCKED (decision) |
| **VAT return** | Internal period summary reconciles to tax GL | Not a statutory return format; accountant must file | Legal obligation requires manual submission or Odoo | BLOCKED (decision) |
| **ETA live submission** | Full pipeline built, contract-tested | Live sandbox + e-seal bridge never exercised | Legal obligation from day one | BLOCKED (credentials) |
| **Payroll** | Employee expenses/advances only | No salary, attendance, leave, overtime | Must be external/manual pilot | BLOCKED (scope) |

### 3.3 Features NOT Implemented (explicitly out of scope or deferred)

| Feature | Classification | Rationale | Source |
|---|---|---|---|
| Fixed assets/depreciation | DEFERRED | Stays on Odoo or manual | PRODUCTION_READINESS.md §H |
| Multi-currency | NOT REQUIRED | EGP-only is correct for UNITED | PRODUCTION_READINESS.md §I |
| Manufacturing/MRP | NOT REQUIRED | Not in UNITED's business | SCENARIO_AUDIT §11 |
| E-commerce integration | NOT REQUIRED | Not in UNITED's business | SCENARIO_AUDIT §11 |
| Inter-warehouse transfer | DEFERRED | Single warehouse MVP | ROADMAP |
| Customer discount codes | P3 (OPTIONAL) | Not blocking; ROADMAP | ROADMAP |
| Audit log search/filter UI | P3 (OPTIONAL) | API exists; UI needed | ROADMAP |

---

## 4. SCREEN-BY-SCREEN UI/UX AUDIT

### Methodology
For each screen I examined the component code, route, and test evidence. I did NOT visually render every screen (the system has no GUI screenshot tool available in this environment). Where I list issues, they are from code inspection, component logic, and navigation structure — not from visual observation.

### 4.1 Login (`/login`)

| Dimension | Assessment |
|---|---|
| Route | `app/login/page.tsx` — simple form, username+password |
| Role-based landing | Redirects to `homePathFor()` based on permissions |
| States | Login errors, rate-limit feedback, session expiry — all implemented |
| Risk | Public route; tested in session-isolation 22/0, security 70/0 |
| **Recommended improvement** | Add loading spinner on submit; currently may appear slow for 5+ sec login |

### 4.2 Preparation Board (`/prep` — Tablet 1)

| Dimension | Assessment |
|---|---|
| Component | `components/prep/PrepBoard.tsx` — shows orders in preparing state |
| Tablet-first? | Code uses responsive classes; target tap areas adequate |
| Workflow | Order → items → mark prepared qty → mark done → status advance |
| Gaps | No warning before marking done if prepared < ordered (requires override); shortage route exists but requires supervisor |
| **Recommended improvement** | Add inline quantity validator showing prepared vs ordered before submission |

### 4.3 Loading Board (`/load` — Tablet 2)

| Dimension | Assessment |
|---|---|
| Component | `components/load/LoadBoard.tsx` — shows ready_for_loading orders |
| Workflow | Load each item qty → mark done → dispatch |
| Supervisor rejection | `components/order/OrderDetail.tsx` — reject status with reason form |
| Gaps | Rejection reason form validation — `ReasonAction.tsx` requires non-empty text |

### 4.4 Supervisor Command Center (`/supervisor`)

| Dimension | Assessment |
|---|---|
| Pages | `/supervisor`, `/supervisor/exceptions`, `/supervisor/report`, `/supervisor/audit` |
| Components | `SupervisorBoard.tsx`, `NeedsAttentionQueue.tsx`, `PipelineFunnel.tsx`, `ExceptionsView.tsx`, `DailyReportView.tsx`, `AuditLogView.tsx` |
| Coverage | Full operational view: funnel, queue, exceptions, daily report, audit log |
| Gaps | **Audit log has no search/filter UI** — only raw list from API; P3 deferred |

### 4.5 Production Sheet (`/production/sheet`)

| Dimension | Assessment |
|---|---|
| Component | `components/production/PickingSheet.tsx` |
| Test | picking-sheet 29/0 — all workflows covered |
| Gaps | None detected; feature is new and well-tested |

### 4.6 Sales (`/sales`)

| Component | Assessment |
|---|---|
| `CustomersView.tsx` | Customer list, search, filters, create/edit |
| `QuotationsView.tsx` | Quotation workflow, transition buttons |
| `InvoicesView.tsx` | Invoice list with filtering, issue, void, credit-note actions |
| `OrderPricingPanel.tsx` | Price override form with reason capture |
| `PriceListsView.tsx` | Price list management |
| Gaps | No `return` flow from sales side (returns are warehouse/operations) — by design |

### 4.7 Purchasing (`/purchasing`)

| Component | Assessment |
|---|---|
| `PurchasingView.tsx` | Orders, RFQs, suppliers, bills aggregates |
| `BillsView.tsx` | Bill list, create, post, debit notes |
| Gaps | None critical; all required flows present |

### 4.8 Stock (`/stock`)

| Components | Assessment |
|---|---|
| `StockDashboard.tsx` | Summary tiles — stock levels, recent movements |
| `QuickIntakeForm.tsx` | Intake form with grading fields |
| `InventoryView.tsx` | Product list, on-hand, locations |
| `MoveForms.tsx` | Transfer, adjust, scrap forms |
| `ProductMasterView.tsx`, `ProductsPanel.tsx`, `SuppliersPanel.tsx` | Master data management |
| `LedgerView.tsx`, `MovementRow.tsx` | Stock movement history |
| Gaps | **No bulk intake form for high-volume receiving** — each intake is line-by-line (acceptable for produce receiving one product at a time) |

### 4.9 Accounting (`/accounting`)

| Component | Assessment |
|---|---|
| `AccountingView.tsx` | Journals, trial balance, periods, reconciliation health |
| Gaps | **Cancelled-report** was added this session (previously disabled) — now working. **No drilldown from trial balance to journal lines** — each must be navigated separately. P3. |

### 4.10 HR (`/hr`)

| Component | Assessment |
|---|---|
| `HrView.tsx` | Employees, expenses, advances |
| Gaps | **No payroll module** — salary, attendance, leave, overtime absent. Only expense workflow present. |

### 4.11 E-Invoicing (`/eta`)

| Component | Assessment |
|---|---|
| `EtaView.tsx` | Issuer profile, receiver profiles, item codes, unit types, document status |
| Gaps | **Live submission not exercised** — all contract-level tests pass; real ETA SDK untested |

---

## 5. ARABIC/RTL/TABLET/PRINTING AUDIT

| Item | Assessment | Status |
|---|---|---|
| Arabic labels in navigation | All nav links in Arabic | VERIFIED |
| RTL alignment in tables | Tailwind `dir="rtl"` on all pages | VERIFIED (from component inspection) |
| Mixed Arabic/English text (bilingual) | `PrintBar.tsx`, `PrintHeader.tsx` — dual-language render | VERIFIED (code inspection) |
| Number formatting (Arabic numerals) | Uses `toLocaleString()` — locale-aware | PARTIAL — not tested in browser |
| Decimal/currency display | Prisma Decimal → string presentation; no floating point | VERIFIED |
| Date formatting | `todayLocalISO()` etc. — Egyptian locale | VERIFIED |
| Print layout | `components/print/*` — print CSS classes | VERIFIED (code exists) |
| Tablet tap targets | Responsive grid; min target ~44px | PARTIAL — not tested on actual tablet |
| Keyboard/focus behavior | Form auto-focus, tab order | NOT VERIFIED |
| Validation feedback | Components show inline errors | VERIFIED (code inspection) |

---

## 6. PERMISSIONS & SECURITY FINDINGS

| Area | Finding | Evidence | Verdict |
|---|---|---|---|
| API-level RBAC | Every route gates with `requireAuth` + `assertPermission` | rbac 248/0, security 70/0 | VERIFIED |
| Self-approval blocked | `approval-handlers.ts` excludes requester | UAT §3, 185/0 | VERIFIED |
| Field-level redaction | Floor never sees prices | UAT §9-11 | VERIFIED |
| Session expiry/epoch | Password change revokes all sessions | password-change-session 21/0 | VERIFIED |
| Login lockout | 5 attempts → 5 min lockout | session-isolation 22/0 | VERIFIED |
| Rate limiting | Per-IP + per-user | loginRateLimit.ts | VERIFIED |
| Audit trail | All state changes logged | audit route, all suites | VERIFIED |
| IDOR prevention | Party-level scoping in queries | UAT, security 70/0 | VERIFIED |
| **No MFA** | Not implemented | — | P3 (deferred) |
| **No IP allowlisting** | Not implemented | — | P3 (deferred) |

---

## 7. END-TO-END BUSINESS INTEGRITY FINDINGS

| Integrity check | Finding | Evidence | Verdict |
|---|---|---|---|
| Journal balance (double-entry) | Every source posts one balanced JE | Direct SQL: balanced YES | VERIFIED |
| AR = GL 1300 per party | AR aging matches customer balance | accounting integrity | VERIFIED |
| AP = GL 2100 per party | AP aging matches supplier balance | accounting integrity | VERIFIED |
| Inventory = GL 1400 | Valuation matches movement sum | accounting integrity | VERIFIED |
| Duplicate invoice → 409 | Advisory lock + partial unique index | UAT §16 (3 concurrent → 1×200 + 2×409) | VERIFIED |
| Credit ≤ invoiced per line | `credited` groupBy | uat §17 | VERIFIED |
| Return ≤ issued per order+product | `advisoryXactLock` + cumulative query | returns-integrity §5 | VERIFIED |
| Return ≤ received (supplier) | Same pattern | returns-integrity §5 | VERIFIED |
| One return doc = one credit note | `findFirst(returnDocumentId)` → 409 | returns-integrity §2 | VERIFIED |
| Unknown-cost → flagged → bill PPV | Complete E2E traced | cost-reconciliation 21/0 | VERIFIED |
| Supplier bill unpriced → approval | `matchStatus: unpriced` | cost-reconciliation §3 | VERIFIED |
| Reversal frees capacity | Cumulative queries filter `reversalOfId IS NULL` | documents 38/0 | VERIFIED |

**Gap — business decision required:**

> When a supplier bill posts against a receipt that had NO known cost (unit_cost = null), the journal posts **Dr PPV (full amount) / Cr AP** with **GRNI = 0**. Inventory layers are NOT rewritten. The 0-valuation persists for remaining stock. Cost was recognized via PPV in the P&L, but inventory value remains at 0. This is a defensible design (no silent history rewrite), but must be explicitly approved by the accountant.

---

## 8. MISSING, PARTIAL, DEFERRED & POLICY-DEPENDENT FEATURES

### 8.1 Missing

| Feature | Classification | Impact | Owner |
|---|---|---|---|
| Payroll (salary, attendance, leave, overtime) | MISSING | Operations dependent on external process | Management |
| ETA live submission | MISSING (code complete) | Legal obligation from day one | UNITED IT + Accountant |
| Performance/load testing | MISSING | Unknown headroom | Operations |

### 8.2 Partial

| Feature | What's done | What's missing | Impact |
|---|---|---|---|
| Grade B costing | Location-separated | Independent SKU for separate pricing/margin | Accountant decision |
| Waste write-off | Cost stored in loc_waste | No periodic auto-write-off policy | Accountant decision |
| VAT return | Internal reconciliation | Not a statutory return format | Accountant decision |
| Cancelled-report UI | Route works, test passes | Integrated into AccountingView? Check needed | Enhancement |

### 8.3 Deferred (explicitly)

| Feature | Reference |
|---|---|
| Fixed assets/depreciation | PRODUCTION_READINESS.md §H4 |
| Multi-warehouse / inter-warehouse transfer | ROADMAP |
| Customer discount codes | ROADMAP P3 |
| Audit log search/filter UI | ROADMAP P3 |
| Multi-currency (not needed) | PRODUCTION_READINESS.md §I7 |

### 8.4 Policy-Dependent

| Item | Dependency |
|---|---|
| Unknown-cost PPV/GRNI treatment | Accountant sign-off on §3 of STAGING_PILOT.md |
| AVCO vs FIFO per product | Accountant decision |
| Waste write-off timing | Accountant decision |
| ETA tax subtypes | Accountant confirmation |
| Tax recognition basis (invoice vs cash) | Accountant decision |
| Future-dated posting restriction | Accountant/management decision |

---

## 9. REGRESSION RISKS

| Item | Risk | Mitigation |
|---|---|---|
| Snapshot-based RBAC test | If a new route is added without regenerating snapshot, CI fails | Unit 92/92 includes snapshot check; `scripts/rbac/matrix.ts` regenerates |
| DB constraint P2002 (unique) → 409 | `lib/rbac.ts` maps to 409; but PG aborts transaction — can't recover in same tx | Design limitation, documented; advisory lock prevents most conflicts |
| Migration pending production | `20261014120000_allow_void_draft_recovery` applied locally, not in prod | Documented; `prisma migrate deploy` applies it at cutover |
| PostgreSQL restart required | DB was killed during process restart; needed manual restart | Known ops procedure needed |
| Shared DB cross-suite pollution | `returns-integrity` and `cost-reconciliation` create same-day data affecting `flows` totals | Documented; canonical chain avoids (flows runs before these suites) |

---

## 10. PRIORITIZED REMEDIATION BACKLOG

| Priority | Item | Dependencies | Acceptance Criteria | Estimated effort |
|---|---|---|---|---|
| **P0** | Accountant sign-off on PPV/GRNI unknown-cost treatment | Accountant availability | Written approval or documented decision with reasons | 1 day |
| **P0** | ETA sandbox credentials + live submission test | UNITED IT + ETA portal | Sandbox checklist in STAGING_PILOT.md §3 executed | 3-5 days |
| **P0** | Payroll scope decision | Management | Document external/manual path; no code change needed | 1 day |
| **P1** | Production restore drill | IT + backup | `BACKUP_RESTORE.md` executed against real backup | 1 hour |
| **P1** | Staff human UAT (warehouse/sales/accounting) | Staff availability | Each role's test scripts from STAGING_PILOT.md §4 signed off | 2-3 days |
| **P1** | Migration apply + permissions sync on production | IT | `prisma migrate deploy` + `db:sync-permissions` | 30 min |
| **P2** | Grade B SKU decision (separate product vs location) | Management | Document decision | 1 day |
| **P2** | Waste write-off timing policy | Accountant | Periodic vs immediate; no code change needed | 1 day |
| **P2** | Lint configuration | Team | Run `next lint --strict`, add eslint config | 2 hours |
| **P3** | Audit log search/filter UI | None | Add search/filter fields to audit page | 1 day |
| **P3** | Number formatting verification in browser | None | Visual check of all numeric outputs | 2 hours |

---

## 11. DECISIONS AWAITING THE ACCOUNTANT

| # | Decision | Options | Reference |
|---|---|---|---|
| 1 | **PPV/GRNI treatment for unknown-cost receipts** | (A) Accept: Dr PPV full / Cr AP, GRNI 0, layers not rewritten; (B) Require unit_cost at intake time | cost-reconciliation.test.ts §3, STAGING_PILOT.md §3 |
| 2 | **Costing method: AVCO vs FIFO per product** | Current AVCO default; can be changed per product | PRODUCTION_READINESS.md §I1 |
| 3 | **Grade B: separate SKU vs location-blended** | Blended COGS (current) vs independent pricing | STOCK audit §5.3 |
| 4 | **Waste write-off timing** | Periodic scrap vs immediate write-off | Stock INTENT |
| 5 | **ETA tax subtypes** | Confirm V003/V004 (exempt), V009 (14%), V001 (0%) | ETA_EINVOICE.md |
| 6 | **Tax recognition basis** | Invoice dates (current) vs cash basis | PRODUCTION_READINESS.md §I7 |
| 7 | **Chart of accounts finalization** | Not yet received — treat as pending dependency | This session |

---

## 12. GIT/ENVIRONMENT STATUS

| Item | Value |
|---|---|
| Repository | `/opt/data/united-investigation` |
| Branch | `united-full-project` |
| HEAD | `7bccad7425103a5d0c4b37befab380e2f193a103` |
| Origin HEAD | Identical (7bccad7) |
| Staged | 0 files |
| Modified tracked | 52 files (43 pre-existing + 9 from recent sessions) |
| Untracked | 39 files (35 pre-existing + 4 from recent sessions) |
| Dev server | Running on port 3000, health OK |
| DB | `united_test@localhost:5433` — isolated, NOT production |
| Production | **Not accessed.** No commits, pushes, deployments, or production operations |

**No deployment, publication, pilot activation, or production change occurred during this audit.**

---

Your move, Mostafa. 🗂️🎯

محقق خارج. تحت أمرك. والسلام. 🕊️🤲