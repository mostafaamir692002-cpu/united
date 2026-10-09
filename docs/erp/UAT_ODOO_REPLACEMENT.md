# Odoo-replacement UAT — final report

*2026-10-08/09. UNITED's real business run end to end through the live application, by
the role that does each step. Suite: `tests/uat.test.ts` (`npm run test:uat`, part of
`npm run test:all`).*

> **Historical UAT evidence, not current production approval.** The totals, environment,
> and go-live conclusions below describe the original 2026-10-08/09 run. The current
> readiness review has 86 passing unit tests, a passing TypeScript check and production
> build, but did not rerun the database-backed UAT against an isolated current database.
> See `PRODUCTION_READINESS.md` before making a go-live decision.

**Result: 181 / 181 UAT checks green. The full regression passes from a fresh reset:**

| Suite | Checks |
|---|---|
| Unit | 67 |
| Integration | 48 |
| End-to-end suites, including the UAT | 1,800 |

**Data used.** All of it is realistic UNITED data:
- Fresh vegetables in KG: tomato, cucumber, potato, plus one VAT-14% packed salad.
- Three customers: a hotel and a restaurant chain (both B2B with tax numbers) and a cash café.
- Two suppliers: a farm on 30-day terms and a market on cash.
- Two cold rooms plus the receiving bay.
- Opening balances, partial fulfilment, a shortage, rejections, a failed delivery, returns
  both ways, a physical count, an expense, a bounced-cheque style reversal, and duplicate
  submissions.

## A. Readiness score: **76 / 100**

| Area | Weight | Score | Why |
|---|---|---|---|
| Connected operational flows (sales, dispatch, purchasing, inventory) | 30 | 28 | All scenarios pass. Missing: inter-warehouse transfer, receiving idempotency |
| Accounting correctness and consistency | 25 | 24 | Every document gives its exact journal; health checks, subledgers and GL agree; one aging bug fixed |
| Controls (RBAC, approvals, periods, duplicates) | 15 | 14 | 36 cross-role attempts (7 roles) refused; approvals segregated; closed periods locked |
| Reporting | 10 | 8 | Historical score: statements and aging correct; management reports agree with the GL; the later internal VAT summary was not part of this UAT |
| Statutory / tax (ETA e-invoicing, VAT declaration) | 15 | 2 | ETA layer built but not SDK-verified, no credentials, no signing; no VAT return |
| Go-live readiness (master-data import, accountant decisions) | 5 | 0 | Historical score: original UAT had no bulk import; CSV templates now exist, while real-data reconciliation and accounting policy decisions remain |

The score covers that historical run, not today's production readiness or feature count.
The current system has not been certified to run UNITED's live operations; statutory
e-invoicing and other accounting functions also still need Odoo or a manual process.

## B. Critical

**None open.** No scenario produced an accounting mismatch, an inconsistent quantity, a
lost or duplicated money document, or a permission leak.

## C. High

1. **ETA e-invoicing is not production-ready.** The mapping, validation, idempotency and
   permissions are built and tested. However:
   - the mapping has not been verified against the official SDK, which this environment
     cannot reach;
   - there are no ETA credentials;
   - there is no e-seal signing bridge;
   - no item codes are registered;
   - the accountant has not confirmed the tax subtypes.

   Egyptian B2B invoices must be e-invoices, so UNITED cannot stop using Odoo (or the ETA
   portal) for e-invoice submission yet.

## D. Medium and low

| Sev | Area | Finding | Business impact |
|---|---|---|---|
| ~~MEDIUM~~ FIXED | Receiving | ~~Two identical stock receipts sent at the same instant both post.~~ Fixed in the final hardening pass: a client key per receiving form; sequential, concurrent and retried duplicates return the first receipt (`tests/integration/stock-receipt-idempotency.test.ts`, UAT §14). | — |
| MEDIUM | Orders | A shortage approved at preparation is raised again at loading when the same quantity is loaded. | The supervisor approves the same difference twice. Friction, not an error. |
| MEDIUM | Inventory | Transfers work only between locations of one warehouse; there is no inter-warehouse transfer document. | None today (one site); must exist before a second site opens. |
| MEDIUM | Returns | No quarantine location is configured, so returns go to the receiving bay and can be picked again uninspected. | Food-safety process choice (see Accountant / business decisions). |
| LOW | Opening balances | An opening balance's due date cannot precede its posting date. | Receivables already overdue in Odoo age from go-live, not from their original due date. |
| LOW | Test harness | The suites compute "today" from the container clock; the server uses Cairo business dates. Between 21:00 and 24:00 UTC, date-sensitive checks fail unless run with `TZ=Africa/Cairo`. | Tests only; no production effect. |

## E. Fixed during UAT (each fix re-verified, then the full suite re-run)

1. **Opening balance with a due date before its date returned HTTP 500.** A DB constraint
   leaked as a server error. It is now a clear 400 validation message
   (`lib/accounting/integrity.ts`).
2. **AR and AP aging dropped over-credited documents.** A credit or debit note on an
   invoice or bill that was already paid left a negative open amount, which aging ignored.
   Aging then overstated what the customer or supplier owed, against the statement and GL.
   That credit now counts as on account, like unapplied money (`agingReport`,
   `apAgingReport`). Pinned by UAT §18: hotel price allowance and farm debit note.
3. **Quarantined stock could not be released.** Picking excluded quarantine even when the
   operator named the quarantine location, so goods there could not be scrapped or moved
   to a cold room without naming a lot. Automatic picking still never touches quarantine;
   explicit requests now can (`lib/inventory/picking.ts`). Pinned by
   `tests/integration/quarantine-release.test.ts`, which fails without the fix.
4. **Reverted, not shipped:** seeding a quarantine location. Correct by design, but it
   changes daily warehouse behaviour (returns stop being available until released) and an
   established suite pins the current behaviour. It is moved to a business decision below.

## F. Intentional behaviour (verified, not bugs)

* **Write-offs, issues and returns are valued at the moving average (AVCO).** For example,
  the 15 kg count variance came to 58.25, not 60.
* **Asking again for an order's invoice returns the same invoice (200)**, never a second
  one.
* **An order's shortage is reviewed again at loading** (see D).
* **A document's journal can't be reversed by hand and an issued invoice can't be voided.**
  The correction is a credit note or a reversal document.
* **Invoices are drafted from the quantity the customer accepted.** Damaged and rejected
  goods are not invoiced. Rejected goods return to stock; shortage and damage are
  exceptions.
* **An invoice that is paid and then credited prints "paid in full".** The credit sits on
  the customer's account, and the credit note is a separate document.
* **Bill price variances need management approval.** The accountant who books the bill
  can't approve it, and the supervisor can't approve expenses.

## G. Decisions for the accountant / management

1. **Costing method:** AVCO, the current default, or FIFO, per product.
2. **ETA tax subtypes:**
   - exempt fresh produce: V003 (exempt) or V004 (non-taxable);
   - VAT14: V009;
   - VAT0: V001.
3. **Person-ID threshold** for B2C e-invoices: 50,000 EGP, per ETA's published rule.
4. **Returns quarantine:** whether returns go to quarantine. Enabling it means creating one
   location of type "quarantine" in master data; the system then handles release and scrap.
5. **Shortage double approval:** keep it, or change the rule so the loading check compares
   against the already-approved quantity (a code change to the order workflow).
6. **Opening receivables already overdue:** post them on their original invoice dates, or
   accept that they age from go-live.

## H. Connected flows verified (21 scenarios)

1. Quotation → order → preparation → trip → partial delivery (8 kg rejected, 2 kg damaged)
   → invoice on the accepted quantity with VAT on the salad only → bank receipt with a
   remainder on account → AR, statement, aging and GL.
2. Shortage (120 of 150 kg) → supervisor approval (twice) → direct dispatch → invoice on
   the approved quantity.
3. RFQ to two suppliers → quotes → award by cheapest line → two POs → receipts with lots,
   expiry and sorting (30 kg rejected) → bills (one with a 2.6% variance → management
   approval) → AP → cash and bank payments → GL.
4. Transfer COLD-2 → COLD-1: lot and expiry carried, total unchanged, no accounting effect.
5. Count → variance (−15 kg) → approval (not by the counter) → adjustment → ledger →
   write-off.
6. Trip with two stops: one delivered, one failed (shop closed). All 40 kg came back,
   COGS was reversed, and the failed order was not invoiceable. No correction needed.
7. Customer return with the goods back → credit note: AR, sales returns, VAT reversed,
   COGS reversed.
8. Supplier return with the goods out → debit note: AP, goods value, PPV split, GRNI left
   at zero.
9. Employee expense above the limit → management approval → posted to employee payable →
   cash reimbursement → employee statement settled.
10. Opening customer and supplier balances and opening stock → subledgers → GL → trial
    balance.
11. Every source document checked against its exact journal: invoice, credit note, stock
    receipt, bill, debit note, money receipt, payment, stock movement, expense, manual
    journal.
12. Period control:
    - posting into a closed month is refused (409) for a manual journal, a money receipt
      and an opening balance;
    - the correction is a reversal entry or a new document.
13. RBAC sweep (36 out-of-responsibility attempts across 7 roles, all refused) plus
    field-level redaction.
14. Duplicates and concurrency, each submitted three times at once:
    - money receipt and payment: one each;
    - stock transfer: one document;
    - dispatch: stock issued once;
    - invoice draft: one invoice;
    - invoice issue: one number and one journal;
    - ETA submission: refused alike, nothing recorded.
15–19. Data consistency, accounts health, inventory health, commercial health and report
    health (below).
20. Invoice print in Arabic RTL and English, matching every issued figure.
21. ETA mapping, validation, missing-data detection, idempotency, permissions and
    credential isolation, with no production submission.

## I. Accounting consistency

**Every document posts exactly one balanced entry with the expected accounts and amounts.**

The accounts-health report is fully green after the whole scenario set:
- trial balance balanced;
- nothing unposted;
- no orphan entries;
- AR, AP and inventory all equal the GL, in total and per party.

Document revenue (invoices minus credit notes) equals GL sales minus returns.

## J. Inventory consistency

For every UAT product, these four figures agree exactly and match the physical story:
- on-hand;
- the sum of the stock ledger;
- the sum of the location/lot buckets;
- the valuation quantity.

| Product | On hand (kg) |
|---|---|
| Tomato | 658 |
| Cucumber | 325 |
| Salad | 22 |
| Potato | 290 |

There are no negative buckets, and the valuation report and GL move by identical amounts.

## K. RBAC

The server enforces role boundaries:
- The floor sees no money or prices.
- The stock controller sees quantities but not costs.
- Sales neither books nor pays.
- The purchaser neither receives, books nor pays.
- The accountant does no floor actions and does not self-approve.
- The supervisor runs operations but has no books.

The ETA screen is visible to finance and supervisors only, and credentials are never
exposed.

## L. Data integrity

- **Duplicate money is impossible:** receipts and payments use idempotency keys and locks.
- **Double dispatch and double invoicing are impossible.**
- **Ledgers and ETA state are append-only and permanent.**
- **Closed periods are locked.**
- **Stock-receipt retries are idempotent in current code and unit coverage.** The PostgreSQL concurrency scenarios were not rerun in this readiness review.

## M. Functional coverage demonstrated in the historical UAT

- **Sales:** customers, quotations, orders, pricing, credit control.
- **Operations:** preparation, loading, trips, delivery results, exceptions.
- **Inventory:** receiving with lots, expiry and sorting; transfers between rooms; counts;
  scrap; returns; valuation.
- **Purchasing:** RFQ, PO, three-way-matched bills, debit notes.
- **AR / AP:** invoices, credit notes, receipts, payments, reversals, statements, aging.
- **General ledger:** journals, periods, trial balance, bank reconciliation, accounts
  health.
- **HR money:** employee expenses, advances, reimbursements.
- **Reports:** management finance and operations.
- **Printing:** the UNITED invoice (Arabic and English).

## N. What still needs Odoo or a manual process

1. **ETA e-invoice submission.** Until production readiness is achieved, submit through the
   ETA portal or Odoo.
2. **VAT return / tax declaration.** The internal period summary now reconciles invoice
   and bill tax (including credits/debits) to accounts 1500/2200; it is not the official
   return format or an electronic filing.
3. **Fixed assets and depreciation.** Not in UNITED ERP.
4. **Payroll.** Not in UNITED ERP; only expenses and advances are.
5. **Bulk master-data and opening-balance import from Odoo.** CSV/XLSX templates with
   preview now exist, but direct Odoo column mapping and reconciliation against UNITED
   exports remain. Manual card entry is also supported.
6. **A second warehouse.** Inter-warehouse transfers are needed first.

## O. Exact next steps

1. **Receiving idempotency key** (the MEDIUM finding). Use the same pattern as transfers:
   one column plus the key check in the receipt transaction, and the receiving form sends
   a per-form key.
2. **Accountant decisions G1–G6.** Then set AVCO/FIFO, confirm the ETA subtypes, and decide
   on quarantine (one master-data location if yes).
3. **ETA production:**
   - verify `lib/eta/mapper.ts` against the SDK pages;
   - register the ERP and obtain pre-production credentials;
   - install the e-seal signing bridge;
   - register item codes;
   - submit test invoices in pre-production;
   - only then use production.
4. **Odoo cut-over data:**
   - import customers, suppliers and products (one-off script or CSV import);
   - enter opening balances and stock with the go-live screen;
   - reconcile the trial balance against Odoo on cut-over day.
5. **Run in parallel with Odoo for one monthly close.** Compare the trial balance, AR/AP
   aging and stock valuation, then switch off Odoo for operations.
6. **Later, by need:** inter-warehouse transfer, a VAT-return report, and fixed assets or
   payroll if they are run in Odoo today.
