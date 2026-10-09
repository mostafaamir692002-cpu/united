# Connected-ERP audit — purchase, sales, inventory, money

*2026-10-08. Goal: UNITED ERP replaces Odoo, so every department must read the same
business truth. Each major transaction was traced from the screen through the API and
service into the database and the general ledger. For each transaction we answer the ten
audit questions. Then come what was wrong, what was fixed, and what is still open.*

Proof: `tests/flows.test.ts` runs UNITED's real day end to end on a live server: go-live
balances, purchase, sale with partial acceptance, payments, a bounced cheque, a returned
transfer, and returns both ways. It checks every step against the GL (57 checks). It ends
with the integrity report, which must be green. It runs in `npm run test:all`.

## The rule everything follows

> **Documents are the truth. The ledger is derived from them, in the same transaction, once.**

* Quantities live in one place: the **stock ledger** (`StockMovement`, append-only, with
  lots and valuation layers). Order lines record what the floor did, and PO "received"
  quantities are derived from posted receipts. Nothing keeps a second balance.
* Money owed lives in **documents**: invoices, credit notes, bills, debit notes, receipts,
  payments, opening balances and reversals. A customer's or supplier's balance and
  statement are computed from them.
* The GL is **posted by those same documents**, inside their own database transaction, with
  a unique `(sourceType, sourceId)`. A document and its accounting can never disagree, and
  nothing can post twice.
* The **control accounts** move only through documents: receivables 1300, payables 2100,
  inventory 1400, GRNI 2150, and employee advances/payables 1600/2300. A manual journal on
  them is refused (new, see below).
* **Accounts health** (`/accounting` → سلامة الحسابات, `GET /api/accounting/integrity`)
  checks all of this on the live data:
  * trial balance;
  * every document and stock movement posted;
  * every journal entry traceable to its source;
  * AR and AP equal to their documents, in total and per party;
  * inventory value equal to account 1400.

## Answers per transaction

Questions: **(1)** source of truth · **(2)** modules affected · **(3)** actually updated ·
**(4)** transactional · **(5)** auditable · **(6)** can it be duplicated · **(7)** can
quantities go inconsistent · **(8)** can accounting mismatch · **(9)** can the API bypass it ·
**(10)** does the UI show the resulting state.

### Purchase chain: PO → receive/sort → inventory → bill → AP → payment

| | Purchase order | Receipt against PO (sorting) | Supplier bill | Supplier payment |
|---|---|---|---|---|
| 1 | `PurchaseOrder` + lines | `StockIntake` → `StockMovement` + lot + valuation layer | `SupplierBill` + lines (one per receipt) | `SupplierPayment` + allocations |
| 2 | Purchasing; approvals (above threshold) | Stock, lots/expiry, PO progress, GL | AP, GL, PO | Cash/bank, AP, bills |
| 3 | No stock and no GL. A PO is a commitment, which is correct | Stock + Dr Inventory / Cr GRNI at the **PO cost**, in the receipt's transaction (**fixed**: it used to be a batch) | Dr GRNI (receipt value) + price variance + VAT / Cr AP (supplier) | Dr AP / Cr cash or bank; bill open amount |
| 4 | Yes | Yes: stock, lots, valuation and journal are one transaction | Yes | Yes (allocation cap enforced by a DB trigger at commit) |
| 5 | Audit + approval record | Audit; movements append-only | Audit; append-only once posted | Audit; append-only |
| 6 | Allowed by design (separate POs) | Unique receipt numbers. A receipt with a live bill can't be corrected or voided | DB: one live bill per receipt; supplier invoice number once per supplier | **Fixed**: an idempotency key per form makes a double tap or retry return the first payment; the button locks while sending |
| 7 | "Received" is derived from posted receipts, never stored | Good quantity only; rejected never counts; tolerance 10% | Bill matched per line against received × agreed price | — |
| 8 | — | Cost comes from the PO; a typed cost is refused | Variance beyond 1% needs `purchasing.bills.approve` (not the accountant) | Allocations can't exceed the payment (DB) or the bill's open amount (service) |
| 9 | `purchasing.*` gates; RBAC suite A1 tests every handler × role | `stock.intake`; the receiver never sees prices | `purchasing.bills.*` | `accounting.payments.manage` |
| 10 | PO status + received progress | Receipt with good/rejected per line | Match verdict, open amount, payments | List with allocated / on account; **reversed** rows struck through with reason |

### Sales chain: order → reserve → prepare → load → trip → partial acceptance → invoice → AR → receipt

| | Dispatch (stock issue) | Delivery result (POD) | Invoice | Customer receipt |
|---|---|---|---|---|
| 1 | Order lines (last confirmed qty: loaded, then prepared, then required) → `issue` movements | `DeliveryLine` per stop/line | `SalesInvoice` from **accepted** quantity | `CustomerReceipt` + allocations |
| 2 | Stock, reservations, exceptions, GL | Stock (refused goods back), exceptions, invoicing basis | AR, GL, credit exposure, order page | Cash/bank, AR, invoices |
| 3 | Stock out + Dr COGS / Cr Inventory **at FIFO lot cost, in the same transaction** (**fixed**) | Refused goods: a `customer_return` movement, Dr Inventory / Cr COGS. Shortage and damage become exceptions, not stock moves (they already left) | Dr AR / Cr Sales (+ VAT) | Dr cash or bank / Cr AR |
| 4 | Yes, per order (a trip resumes order by order) | Yes | Yes: number, lines and journal | Yes |
| 5 | Audit; Arabic order timeline (**fixed**: some events showed raw keys) | Audit | Append-only once issued | Audit; append-only |
| 6 | Order state machine; a second dispatch is refused | Unique per stop + line | DB: one live invoice per order | **Fixed**: idempotency key (three simultaneous submits → one receipt, tested) |
| 7 | Lenient by default: a short line becomes a stock-issue exception, so the books record what physically left | Delivered ≤ loaded | Invoiced = accepted (85 of 100 → 85, tested) | — |
| 8 | Cost from the lots actually consumed | Return at original issue cost | Credit notes capped at the remaining quantity per line | Allocation ≤ receipt (DB) and ≤ invoice open (service) |
| 9 | `orders.*` gates; floor roles never see prices (separate price table) | `orders.*` / trips | `sales.invoices.*` | `accounting.receipts.manage` |
| 10 | Order page: stage, progress, timeline | Trip screen | **Fixed**: the order page now shows delivery status and invoice state (number, paid / remaining / not invoiced yet) | Same as payments |

### Returns

| | Credit note (customer) | Debit note (supplier) |
|---|---|---|
| 1 | `CreditNote` (+ optional `customer_return` document) | `DebitNote` (+ optional `supplier_return` document) |
| 3 | **Fixed**: with "goods came back", stock re-enters (quarantine) and money is credited in one transaction. Without it, it's a price allowance (money only) | **Fixed**: with "goods go back", stock leaves the receipt's own lot first and money is debited together. Credits GRNI by the goods' value and puts the price difference in PPV (it used to leave GRNI with a residual) |
| 6–8 | Capped per invoice line; restock can't be combined with an already-linked return document | Mirror |

### Inventory

| | Adjustment / scrap / transfer | Opening stock (go-live) |
|---|---|---|
| 1 | Inventory document → movements | Adjustment document `sourceType = opening_balance` |
| 3 | Write-offs to 5200 in the same transaction; transfers move no value | Dr Inventory / Cr **opening-balance equity 3300** (**new**; it would otherwise land in write-offs as an expense) |
| 6 | Client idempotency key | Same |
| 8 | A missing unit cost is refused (**fixed**: it returned 500) | Same |

Stock valuation reaches the GL **per stock transaction**, through `StockValuationPosting`, a
movement → entry map with one row per movement. Before, a periodic watermark run did this;
`POST /api/accounting/sync` remains as a catch-up and finds nothing to do in normal running.

### Money corrections (new)

| | Receipt / payment reversal | Manual journal |
|---|---|---|
| 1 | `CustomerReceiptReversal` / `SupplierPaymentReversal` (append-only, one per receipt) | `JournalEntry` `manual` |
| 3 | The original stays and its allocations stop counting, so the invoices or bills reopen. The reversal posts Dr AR / Cr cash (or the mirror) on its own date | Only on non-control accounts (**new**); corrected by a reversal entry |
| 6 | DB: one reversal per receipt; a second → 409 | — |
| 9 | `accounting.manage` only (a cashier who can record money can't make it disappear) | `accounting.manage` |
| 10 | Statement shows the receipt **and** its reversal; list shows it struck through | Journals tab |

## Gaps found and fixed in this pass

1. **Inventory → GL was a batch job.** Between runs, inventory and COGS in the GL lagged the
   stock ledger and margin reports disagreed with the accounts. Each stock transaction now
   posts its own valuation entry.
2. **Returns were disconnected.** A credit or debit note moved money but not goods, or the
   reverse. Both now do both, atomically, when the goods physically move.
3. **Supplier returns left GRNI residuals.** They are now split between GRNI and PPV.
4. **Go-live had no safe path.** A manual journal for opening AR/AP would put balances in the GL
   that no customer or supplier statement shows. Now there are opening-balance documents
   per party (in statements and aging) and opening stock to opening equity.
5. **No proof that departments agree.** The integrity report and screen were added.
6. **Manual journals could post to control accounts.** That silently breaks subledger = GL.
   They are now refused, with the message naming the document to use instead.
7. **Money couldn't be corrected.** A bounced cheque had no path except that manual journal.
   Reversal documents were added.
8. **Money could be recorded twice** (double tap, network retry). Idempotency keys were added
   and the button locks while sending.
9. **Order timeline showed raw event keys** to the floor. They are all in Arabic now, with a
   unit test that fails on any untranslated key.
10. **Order page didn't show the money state.** It now shows the commercial strip (delivery and invoice).
11. **Navigation crowding.** Multi-department roles now get department groups. Single-
    department roles (preparer, loader) keep their flat pills.

## Still open (deliberately)

* **Egyptian e-invoice / tax invoice format.** We are waiting for the accountant's reference
  invoice. Tax stays configurable per product (default exempt for fresh produce, to confirm
  with the tax adviser).
* **Bad-debt write-off** has no dedicated document yet. Until then, a credit note with the
  reason, or ask for a write-off document (Dr bad debts / Cr AR per party) if it's frequent.
* **Inventory revaluation on bill price differences.** The variance goes to PPV; a per-lot
  revaluation is a refinement.
* **Quality inspection.** Deferred by decision. Sorting at receipt and delivery exceptions cover
  today.
* **Master-data import from Odoo** (customers, suppliers, products, price lists). Recommended
  before go-live so codes match; opening balances and stock are then entered with the tools above.
