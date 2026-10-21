# UNITED ERP — Full Requirements Traceability Matrix

**Date:** 2026-10-18  
**Repository:** `/opt/data/united-investigation`  
**Branch:** `united-full-project` @ `7bccad7425…a103`  
**Grading:** ✅ verified this session ⏳ verified historically ❌ not verified 🔲 not applicable

---

## 1. Security, Authentication, RBAC

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| SEC-01 | JWT session authentication | `lib/auth.ts` — bcryptjs + JWT | unit 92/92, security 70/0 | ✅ |
| SEC-02 | Session epoch: password change invalidates all sessions | `lib/session-guard.ts` | password-change-session 21/0 | ✅ |
| SEC-03 | Sign-in lockout (5 failures / 5 min) | `lib/loginRateLimit.ts` + DB `LoginAttempt` | session-isolation 22/0 | ✅ |
| SEC-04 | Permission-based RBAC (63 permissions, 8 roles) | `lib/authz.ts`, `lib/authz-core.ts`, `lib/permissions.ts` | rbac 248/0, security 70/0 | ✅ |
| SEC-05 | Server-side enforcement, no UI-only guards | Every handler gates via `requireAuth/assertPermission` | security 70/0 — every handler × every role | ✅ |
| SEC-06 | SUPER_ADMIN cannot be locked out | `authz-core.ts` — session epoch exempt | profile-access 48/0 | ✅ |
| SEC-07 | Password is admin-controlled, read-only profile | `app/api/auth/password/route.ts` (deleted), profile page hidden from floor | password-change-session 21/0 | ✅ |
| SEC-08 | Field-level redaction (floor sees no prices) | `lib/prisma.ts` select projection | UAT §9-11 | ✅ |
| SEC-09 | Segregation of duties (approver ≠ requester) | `lib/core/approvals.ts` — self-approval =403 | UAT §3 | ✅ |

---

## 2. Sales, Order Processing, Invoicing

| ID | Rquirement | Implementation | Test Eidence | Verdict |
|---|---|---|---|
|SLS-01| Quotation→order| `api/sals/quotations/*` | uat 185/0 (§1) | ✅ |
|SL-02| Order status machine (create→prepare→load→dispatch→invoice)| it/ses/orders-srvice.ts | rdrs 75/0  ✅ |  
|SAL-03| Order price editing refused after invoice| `lib/orders-service.ts` — 409 on priced invoices | scenarios §3 | ✅ |
|SAL-04| shortage/over approval at preparation + loading | `lib/orders-service.ts` + approval gate | orders 175/0, uat §2 | ✅ |
|SAL-05| Invoice issue — one JE, serialized | `lib/sales/invoicing.ts` — advisoryXactLock | uat 185/0, concurrent-issue test | ✅ |
|SAL-06| Invoice issue — concurrent requests → 409 for losers | `invoicing.ts` lock + partial unique index `JournalEntry_one_per_source` | uat §16: triple test → 200 + 2×409 | ✅ |
|SAL-07| Credit note ≤ invoice per line | `invoicing.ts` — `credited` groupBy per invoice line | uat §17 | ✅ |
|SAL-08| Credit note with return doc: capped at returned qty (base-unit normalized) | `invoicing.ts` — `returnedByProduct` via StockMovement groupBy + toBaseQuantity | returns-integrity §2 | ✅ |
|SAL-09| One return doc → one credit note (reuse blocked) | `invoicing.ts` — findFirst(returnDocumentId) → 409 | returns-integrity §2 | ✅ |
|SAL-10| Pure-financial credit (no return doc) remains allowed | `invoicing.ts` — skips physical cap when no return doc | returns-integrity §3 | ✅ |
|SAL-11| Customer refund (post-payment credit) | `lib/accounting/refund.ts` — built in scenario audit | scenarios §9 | ✅ |
|SAL-12| Customer statement = AR aging | `lib/accounting/statements.ts` | accounting 50/0, integrity check | ✅ |

---

## 3. Purchasing, Supplier Bills, GRNI

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| PUR-01 | PO → receipt (3-way match) | `lib/stock-service.ts` + `lib/purchasing/bills.ts` | purchasing 125/0, flows 57/0 | ✅ |
| PUR-02 | Supplier bill → GRNI/PPV/AP journal | `lib/purchasing/bills.ts` — postSupplierBill | uat §3: journal exact, GRNI 1,064 + PPV 28 / Cr AP 1,092 | ✅ |
| PUR-03 | Unpriced receipt → bill pending_approval | bills.ts — agreedPrice null → "unpriced" → approval request | cost-reconciliation 21/0: management approve path | ✅ |
| PUR-04 | Self-approval of variance blocked | approval-handlers exclude requester | uat §3: karim 403, admin 200 | ✅ |
| PUR-05 | Supplier return → debit note → AP/stock/PpV | `lib/purchasing/bills.ts` — createDebitNote | uat §8, purchasing 125/0 | ✅ |
| PUR-06 | Supplier cumulative return ≤ received quantity | `lib/inventory/documents.ts` — createReturnToSupplier | returns-integrity §5: 5,000>300 → 409 | ✅ |

---

## 4. Customer Returns, Credits, Reversals

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| RET-L01 | Customer return posted → stock movement + inventory document | `lib/inventory/documents.swift` — postCustomerReturnInTx | returns-integrity 27/0 | ✅ |
| RET-02 | Cumulative return per order+product ≤ issued (net reversals) | `documents.ts` — advisory lock + SQL query of issuedPerProduct | returns-integrity §5: 108>100 → 409 | ✅ |
| RET-03 | Concurrent return requests serialized | advisoryXactLock("inventory:customer-return:{orderId}") | code review + returns-integrity | ✅ |
| RET-04 | Reversal frees return capacity | Query filters `d."reversalOfId" IS NULL` | documents 38/0 | ✅ |
| RET-05 | Rreturn from non-issued order (cancel/withdraw) allowed | Cap skiped when no issues exist | inventory 119/0 | ✅ |
| RET-06 | warehouse-only return (no order) allowed | `documents.ts` — when orderId null, no cap | tests/inventory.test.ts | ✅ |
| RET-07 | Return-line→invoice-line link | **Not implemented** — aggregate caps protect financially | Assessed: NOT a release blocker per twin caps (per-line credit cap + per-order product cap) | ⏳ business decision |

---

## 5. Stock Intake, Grading, Valuation

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| STK-01| Intake with grading: good + gradeB + waste + rejected | `app/api/stock/intakes/route.ts` — forwards grade_b_qty, waste_qty | stock 148/0: splits, locations, defaults | ✅ |
| STK-02| gradeB → loc_grade_b, waste → loc_waste | `lib/stock-service.ts` — postIntake | stock 148/0 (§5b) | ✅ |
| STK-03| Intake without unit_cost → unknown cost layer | `lib/inventory/ledger.ts` — costSource: unknown | cost-reconciliation 21/0 (§1) | ✅ |
| STK-04| Intake correction (qty, not cost) with reason, version guard | `lib/stock-service.ts` — updateIntake | stock 148/0 | ✅ |
| STK-05| Stock valuation: AVCO per product | `lib/inventory/ledger.ts` — postMovementValuation | flowss 57/0, accounting 50/0 | ✅ |
| STK-06| Negative stock prevented | DB CHECK + bucket lock per product+location+lot | inventory 119/0 | ✅ |
| STK-07| Duplicate receipt prevented (idempotency) | Advisory lock + unique key | integration/stock-receipt-idempotency | ✅ |
| STK-08| Expired stock excluded from FEFO picking | `lib/stock-service.ts` — FEFO order: expired last for sales | integration expired-lots, scenarios | ✅ |
| STK-09| Stock ledger = inventory on hand = valuation qty | 4-way agreement check | UAT §5, inventory 119/0 | ✅ |

---

## 6. Accounting: Journals, Trial Balance, P&L, Balance Sheet

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| ACC-01 | Every business document posts exactly one balanced JE | Append-only JournalEntry + JournalLine | accounting 50/0, flows 57/0 | ✅ |
| ACC-02 | Trial balance = Σdebits = Σcredits | `lib/accounting/reports.ts` | accounting checks, DB verified | ✅ |
| ACC-03 | P&L = revenue(4100-4200) minus COGS(5100) + PPV(5300) + expenses(6xxx) | Report: `lib/management/reports.ts` | flows 57/0 (§revenue/cost) | ✅ |
| ACC-04 | Balance sheet: AR=1300, AP=2100, inventory=1400, cash=1100/1200 | Integrity query: AR/AP/inventory vs GL | Accounts Health (in all suites) | ✅ |
| ACC-05 | Period close → no postings allowed | `lib/accounting/periods.ts` | uat 185/0 (§19), accounting 50/0 | ✅ |
| ACC-06 | Period close serialize (advisory lock) | `lib/core/dblock.ts` — advisoryXactLock | accounting integration | ✅ |
| ACC-07 | Manual journal — no control accounts touched | `lib/accounting/ledger.ts` — refused: 1300,2100,1400,2150,1600 | UAT §14 | ✅ |
| ACC-08 | Journal reversal creates paired entry | `lib/accounting/ledger.ts` — reversalOfId | cancelled-report 15/0 | ✅ |
| ACC-09 | Unknown-cost flag in finance report | `lib/management/reports.ts` — costUnknownQty + note | cost-reconciliation 21/0 | ✅ |

---

## 7. Unknown-Cost to Known-Cost Transition

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| UNK-01 | Receive stock without unit_cost → layer value 0 | `lib/inventory/ledger.ts` — costSource: unknown | cost-reconciliation §1 | ✅ |
| UNK-02 | Valuation report shows `receivedWithoutCost` | `lib/inventory/reports.ts` — unknown layer query | cost-reconciliation §1: 1,000 | ✅ |
| UNK-03 | Sale at unknown cost → COGS 0, margin flagged | `lib/management/reports.ts` — costUnknownQty | cost-reconciliation §2: 700 | ✅ |
| UNK-04 | Supplier bill at real price → bill pending_approval (unpriced gate) | `lib/purchasing/bills.ts` — matchStatus: unpriced | cost-reconciliation §3: management approves | ✅ |
| UNK-05 | After approval: Dr PPV / Cr AP (GRNI 0) — cost via PPV | `lib/accounting/ledger.ts` — postSupplierBill | cost-reconciliation §3: PPV 4,000 / AP 4,000 | ✅ |
| UNK-06 | Remaining layer not rewritten — history preserved | No update in any posting | cost-reconciliation §3: 300kg still 0 value | ✅ |
| UNK-07 | Re-posting blocked → exactly one JE | Already-same-bill guard in bills.ts | cost-reconciliation §4: 409, 1 JE | ✅ |

**Business decision required:** see §26 below.

---

## 8. Reports, Exports, Cancelled Documents

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| REP-01 | Management finance report | `lib/management/reports.ts` | uat 185/0, flows 57/0 | ✅ |
| REP-02 | CSV export with Arabic BOM | `/export/` routes + `lib/csv-export.ts` | exports 16/0 | ✅ |
| REP-03 | Cancelled/voided transactions report | `app/api/accounting/cancelled-report/route.ts` | cancelled-report 15/0 | ✅ |
| REP-04 | Trial balance export | Via accounting API | accounting 50/0 | ✅ |
| REP-05 | Inventory valuation report | `lib/inventory/reports.ts` | inventory 119/0 | ✅ |

---

## 9. Data Integrity, DB Constraints, Migrations

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| INT-01 | Partial unique index: JournalEntry_one_per_source | Migration `20261008164713_accounting_core` | db-constraints 10/0, UAT §16 | ✅ |
| INT-02 | Append-only ledgers (DB triggers) | `prisma/migrations/…_append_only` triggers | db-constraints 10/0 | ✅ |
| INT-03 | No orphan journal entries | CHECK: every entry has a document, every document has an entry | Accounting Integrity, UAT §20 | ✅ |
| INT-04 | Journal balanced at commit | `lib/ledger.ts` — balance check before commit | All posting tests | ✅ |
| INT-05 | 47 migrations apply cleanly | Verified on isolated DB: `npx prisma migrate deploy` | test db build, reset passes | ✅ |
| INT-06 | Rollback: deploy previous app version (no automated revert) | DOCUMENTED in MIGRATIONS.md | Not exercised this session | ⏳ |
| INT-07 | Duplicate prevention: PO PO, invoice, bill, receipt, payment, refund | Per-type idempotency + unique constraints | integrations 18/0, scenarios | ✅ |

---

## 10. E-Invoicing (ETA)

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| ETA-01 | Mapping to Invoice v1.0 | `lib/eta/mapper.ts` | eta 28/0 | ✅ |
| ETA-02 | Submission with idempotency | `lib/eta/gateway.ts` — ETA keys + state machine | integration eta-submission | ✅ |
| ETA-03 | Permission-gated overview screen | `app/api/eta/*` — gated by `accounting.eta.view` | eta 28/0 | ✅ |
| ETA-04 | 503 when unconfigured (no secrets) | `lib/eta/gateway.ts` — checks env, returns 503 | eta 28/0 | ✅ |
| ETA-05 | **Live sandbox submission** | **NOT DONE** — needs ETA portal credentials + e-seal bridge | **NOT VERIFIED** | ❌ |
| ETA-06 | Status polling from ETA | `lib/eta/gateway.ts` — unknown state | integration eta-submission | ✅ |
| ETA-07 | CAdES signature verification | **NOT DONE** — bridge hasn't run | **NOT VERIFIED** | ❌ |

**Required for production go-live:** ETA sandbox checklist execution with UNITED credentials.

---

## 11. Arabic/RTL UX

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| UI-01 | All labels, errors, and messages in Arabic | All strings in codebase tagged `"{…}"` | robustness 4,685/0 page loads | ✅ |
| UI-02 | RTL table layout | Tailwind `dir="rtl"` | visual inspection | ✅ |
| UI-03 | Number formatting (Arabic numerals in UI) | Locale-aware via `toLocaleString` | — | ⏳ not explicitly verified |
| UI-04 | Print: bilingual (Arabic header + English per listing) | Print CSS + dual columns | — | ⏳ not explicitly verified |
| UI-05 | Tablet/mobile usable | Responsive layout + adequate tap targets | — | ⏳ |

---

## 12. Payroll, Attendance, Leave, Overtime

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| PAY-01 | Employee records with salary | Employee model — no salary field | — | ❌ **NOT IMPLEMENTED** |
| PAY-02 | Attendance tracking | **NOT IMPLEMENTED** | — | ❌ |
| PAY-03 | Leave management | **NOT IMPLEMENTED** | — | ❌ |
| PAY-04 | Overtime calculation | **NOT IMPLEMENTED** | — | ❌ |
| PAY-05 | Payroll period run | **NOT IMPLEMENTED** | — | ❌ |
| PAY-06 | Employee expenses/advances/reimbursements | **IMPLEMENTED** | HR 22/0, employee statement | ✅ |

**Decision required:** Payroll scope — external/manual process acceptable for pilot? Or required before go-live?

---

## 13. Backup, Restore, Recovery

| ID | Requirement | Implementation | Test Evidence | Verdict |
|---|---|---|---|---|
| BAK-01 | pg_dump procedure documented | BACKUP_RESTORE.md | documented | ✅ |
| BAK-02 | Restore-drill procedure + automated checks | `scripts/ops/restore-check.ts` | **drilled earlier** (bit-identical; not re-run this session) | ⏳ |
| BAK-03 | Production restore-drill (against real backup) | **NOT DONE** | — | ❌ |
| BAK-04 | Point-in-time recovery enabled | Supabase feature — operational | — | ❌ not verified |

---

## 14. Performance & Load

| ID | Requirement | Evidence | Verdict |
|---|---|---|---|
| PERF-01 | API response time under normal load | **Not measured in this session** | ❌ |
| PERF-02 | Concurrent request behavior | Proven: invoice concurrency (3 concurrent → 200+2×409), bill concurrency (2→200+409) | ✅ (functional concurrency) |
| PERF-03 | Page render time | **Not measured** | ❌ |
| PERF-04 | Database query performance under load | **Not measured** | ❌ |

---

## 15. Staff UAT & Day-to-Day Operations

| ID | Requirement | Evidence | Verdict |
|---|---|---|---|
| OPS-01 | Warehouse: intake, grade, transfer, count, scrap | Automated E2E suite | ✅ (automated) |
| OPS-02 | Warehouse: customer return, supplier return | returns-integrity 27/0 | ✅ (automated) |
| OPS-03 | Sales: order, dispatch, invoice, credit | orders 175/0, uat 185/0, sales 193/0 | ✅ (automated) |
| OPS-04 | Purchasing: PO, receipt, bill, debit note | purchasing 125/0 | ✅ (automated) |
| OPS-05 | Accounting: journals, trial balance, periods | accounting 50/0 | ✅ (automated) |
| OPS-06 | **Staff UAT with actual warehouse, sales, accounting staff** | **NOT DONE** — acceptance matrix exists, human UAT required | ❌ |

---

## 16. Defect Summary (Severity Ranking)

| ID | Defect | Severity | Status | Files |
|---|---|---|---|---|
| D-01 | Unknown-cost layer never repriced when supplier bill arrives — PPV absorbs full cost; inventory remains at 0 value | **P0 — Accounting-Decision-Dependent** | Documented, awaiting accountant sign-off | cost-reconciliation.test.ts |
| D-02 | ETA live submission never exercised | **P0 — Production Blocker** | Awaiting credentials + signing bridge | lib/eta/* |
| D-03 | Payroll module absent (salary/attendance/leave/overtime) | **P0 — Scope Decision** | External process needed | — |
| D-04 | Physical return not linked to specific invoice line | **P2 — Twin caps prevent financial loss** | Assessed adequate; migration optional | documents.ts |
| D-05 | Lint not configured | **P2 — Quality gate gap** | Team decision | — |
| D-06| Production restore-drill not performed against real backup | **P1 — Go-live prerequisite** | Drill earlier on disposable DB, not production | BACKUP_RESTORE.md |

---

## 17. Current Session Verification Summary

| Check | Result | Verification type |
|---|---|---|
| Canonical E2E chain (21 suites) | **6,624 assertions, 0 failed** | ✅ This session |
| Unit tests | **92/92** | ✅ This session |
| Integration tests | **62/62** | ✅ This session |
| Returns-integrity | **27/0** | ✅ This session (new) |
| Cost-reconciliation | **21/0** | ✅ This session (new) |
| Cancelled-report | **15/0** | ✅ This session (re-enabled) |
| Production build | **exit 0** | ✅ This session |
| TypeScript (`tsc --noEmit`) | **exit 0, 0 errors** | ✅ This session |
| DB double-entry balance | **balanced YES** | ✅ This session (direct SQL) |
| **Staff human UAT** | **NOT RUN** | ❌ |
| **ETA live sandbox** | **NOT EXECUTED** | ❌ |
| **Performance / load test** | **NOT MEASURED** | ❌ |

---

## 18. GO/NO-GO Recommendation

### For staging pilot authorization: **GO**

All automated tests pass (6,841+ assertions, 0 failures), production build succeeds, TypeScript is clean, return/cost integrity is proven with persisted DB evidence. The staging deployment plan in `docs/erp/STAGING_PILOT.md` is ready and awaits owner approval.

### For production authorization: **NO-GO**

Blockers remaining before production cutover:

| # | Blocker | Owner | Resolution |
|---|---|---|---|
| 1 | ETA sandbox credentials + live submission test | UNITED IT + accountant | Execute sandbox checklist in STAGING_PILOT.md §3 |
| 2 | Payroll scope decision | Management | Document external/manual path or build plan |
| 3 | Unknown-cost PPV treatment approval | Accountant | Sign off on §3 of STAGING_PILOT.md |
| 4 | Production restore drill | IT | Execute BACKUP_RESTORE.md against real backup |
| 5 | Staff human UAT | Warehouse + Sales + Accounting | Execute role-specific test scripts (STAGING_PILOT.md §4) |
| 6 | Migration apply + permissions sync | IT | `prisma migrate deploy` + `db:sync-permissions` |
| 7 | Cutover reconciliation vs Odoo | Accountant + IT | Execute CUTOVER.md §4.3 checks |

The existing docs (`CUTOVER.md`, `STAGING_PILOT.md`, `BACKUP_RESTORE.md`) define every check. The code and tests are ready; the operational processes require human execution.