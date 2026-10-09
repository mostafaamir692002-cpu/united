# UNITED ERP — Architecture Assessment & Gap Analysis

Status: Phase Zero output. Written after a full read of the repository and a verified
baseline run (fresh PostgreSQL 16, all migrations applied, seed loaded, production build,
all four regression suites green: RBAC 229 · Orders 165 · Stock 131 · Product Master 108).

This document is the reference for every later phase. It is updated as phases land
(see `ROADMAP.md` for execution status).

---

## 1. Current architecture

| Layer | What exists | Assessment |
|---|---|---|
| Runtime | Next.js 14 App Router, single long-lived Node server, TypeScript strict | Sound. Keep. |
| Data | Prisma 5 + PostgreSQL (Supabase), 6 migrations | Sound; integrity constraints are unusually good for an MVP. |
| Domain | `lib/*-service.ts` own business rules; routes are thin | The right shape. Keep and extend per module. |
| AuthN | JWT (HS256, `jose`) in httpOnly cookie, 12h; bcrypt cost 10 | Sound. Identity re-read from DB on every request. |
| AuthZ | Code-defined permission catalogue → role bundles + per-user grant/revoke, resolved in one query, enforced in services *and* routes | Strong. Keep the mechanism; extend the catalogue. |
| Concurrency | `version` column + compare-and-swap (`WHERE id AND version`) → 409 | Strong. Extend to every new transactional entity. |
| Locking | Postgres transaction-scoped advisory locks for sequences / dedupe / balance checks | Correct and pooler-safe. Reuse. |
| Audit | Append-only `AuditLog`, who/what/when/why/old/new | Good model, but **writes are outside the mutating transaction** in the order service (see §6). |
| Realtime | React Query polling 3–5s | Appropriate for the scale. Keep. |
| UI | Tailwind, RTL Arabic, tablet-first boards, print views | Coherent. Extend into a management-density variant for back-office. |
| Tests | 4 end-to-end suites against a running server + real DB | Valuable, but not safely runnable (see §6, §9). No unit tests. |

## 2. Current database model

Entities: `User`, `Permission`, `RolePermission`, `UserPermissionOverride`, `Order`,
`OrderItem`, `AuditLog`, `Supplier`, `StockProduct` (+ `ProductAlias`), `StockIntake`,
`StockMovement`.

* Enumerations are strings with CHECK constraints (status, source, kind) — acceptable,
  keep the pattern.
* All quantities are `DOUBLE PRECISION` (`requiredQuantity`, `receivedKg`,
  `quantityKg`…). Rounded to 3 dp at service boundaries; CHECKs use a tolerance.
* No money anywhere yet.
* `Order.customerId` / `OrderItem.productId` are free-text external ids, not FKs.
  The canonical product link is `OrderItem.stockProductId`.
* `Order.externalId` has **no unique index** — idempotency relies on an advisory lock.
  *(Fixed in Phase 1.)*
* `Order.deliveryDate` / `StockIntake.receivedDate` are `YYYY-MM-DD` strings with format
  CHECKs in the database. *(Correction: the first draft of this document said the
  order table had none; it has had them since `20260915123621`.)*
* RLS enabled with no policies (blocks Supabase anon/PostgREST; Prisma bypasses).

## 3. Current business workflows

1. **Order intake** — `POST /api/orders` by n8n/Hermes (x-api-key) or a supervisor.
   Idempotent on `external_id`. Lines resolved through the Product Master by exact
   normalized alias; unknown lines are kept as written (UNMAPPED), never blocked.
2. **Preparation** (tablet 1) — `new → preparing → ready_for_loading`; per-line
   prepared qty + done flag; shortage / needs-review flags recomputed on each write.
3. **Shortage gate** — any line off by more than 5% sets `needsReview`; the order
   cannot advance until a holder of `orders.approve` approves with a reason.
4. **Loading** (tablet 2) — `ready_for_loading → loading → loaded`; per-line loaded qty.
5. **Dispatch** — `loaded → dispatched` requires vehicle, driver, crate count.
6. **Supervisor** — edit with reason, required-qty correction, approve, cancel,
   reopen, forced transitions (`status_override`), clone.
7. **Stock** — supplier receipt (received / rejected / good), void, correction,
   manual adjustment; balance = `SUM(StockMovement.quantityKg)`; negative balance refused.
8. **Product Master** — canonical products, globally-unique normalized aliases,
   coverage view for unmapped order lines, audited mapping.
9. **Administration** — users, roles, overrides, last-SUPER_ADMIN protection.
10. **Reporting** — command center, exceptions, daily report, production totals, audit.

## 4. Existing modules — classification

| Area | Verdict | Notes |
|---|---|---|
| RBAC mechanism (`authz`, `authz-core`, overrides) | **KEEP** | Extend catalogue per module. |
| Permission catalogue | **EXTEND** | Add module namespaces (`core.*`, `sales.*`, `inventory.*`, `accounting.*`…) as modules land. Existing keys stay — renaming would orphan live overrides. |
| Optimistic concurrency | **KEEP** | Mandatory for every new transactional table. |
| Order workflow / state machine | **KEEP**, later **EXTEND** | Becomes the fulfilment leg of the Sales Order. |
| Orders service | **REFACTOR** (targeted) | Atomic audit; quantities to Decimal in Phase 2. |
| Audit log | **EXTEND** | Transaction-aware writes; new entity types. |
| Stock ledger | **EXTEND** | Add warehouse/location/lot, reservations, Decimal, valuation layer. Not replaced. |
| Stock intake | **EXTEND** | Becomes the Receiving document (PO link, gross/tare/net, lot, QC). |
| Product Master / identity | **KEEP** + **EXTEND** | Add UoM conversions, categories, supplier/customer data, AI-suggestion state. |
| Suppliers | **EXTEND** | Becomes a full partner master (terms, payables). |
| `lib/config.ts` | **REPLACE** | By a persisted, typed, audited configuration service. |
| Order numbering (MAX+1 under lock) | **KEEP** | New document types use a generic sequence service. |
| Reports | **EXTEND** | Move whole-table scans to SQL aggregation as data grows. |
| Test harness | **REFACTOR** | Safety guard, reproducible reset, unit layer. |
| Customers | **MISSING** | Only a free-text name on the order. |
| Pricing / money | **MISSING** | |
| Purchasing | **MISSING** | |
| Quality control | **MISSING** (rejected kg on intake only) | |
| Logistics / fleet | **MISSING** (vehicle + driver are free text on Order) | |
| Accounting / AR / AP / tax | **MISSING** | |
| HR / expenses | **MISSING** | |
| Documents / attachments | **MISSING** | |
| Approval engine | **MISSING** (shortage approval is hard-coded) | |
| Notifications | **MISSING** (client-side sound alerts only) | |
| Import / export | **MISSING** | |
| Integrations framework | **MISSING** (one shared API key) | |

## 5. Capability matrix

Legend: ● implemented · ◐ partial · ○ missing. "Phase" = where it is built (see §11).

| Capability | Now | Missing (essentials) | Key dependencies | Phase |
|---|---|---|---|---|
| Core (company, branch, warehouse, UoM, currency, settings, sequences) | ○ | all | — | 1 |
| Administration | ◐ users/roles | org master data, settings, sequences, approval rules, integrations | Core | 1 |
| Audit | ◐ | transactional writes, generic entity types, before/after JSON | — | 1 |
| Approvals | ○ | generic request/decision/levels/thresholds | Core, notifications | 1 |
| Notifications | ○ | in-app inbox, channel adapters | Core | 1 |
| Documents | ○ | attachment store, metadata, entity link, safe upload | Core, storage | 1 |
| Products | ● inventory attributes (Phase 2) | category tree, tax class (Phase 3/6) | Core UoM | 2 |
| Inventory | ● Decimal ledger by location & lot, reservations, transfers, counts, returns, FEFO/FIFO, valuation layers, dispatch issue (Phase 2) | inter-warehouse transit, count sessions, GL posting | Core, Products | 2 |
| Warehouse | ● warehouses, typed locations (cold room, quarantine…), cold-chain rule | zones / bin capacity | Core | 1–2 |
| Customers / CRM | ● master, contacts, credit terms, price list, statement, aging (Phase 3) | addresses per branch, CRM activities | Core | 3 |
| Pricing | ● dated price lists, customer lists, overrides, tax classes (Phase 3) | promotions / volume breaks | Customers, Products, Tax | 3 |
| Sales | ● quotations, priced orders, credit control, reservations, invoices, credit notes (Phase 3) | POD-based delivered quantity (5) | Customers, Pricing, Inventory | 3 |
| Suppliers | ● master, codes, tax id, terms, contacts, dated prices, statement (Phase 4) | product codes, performance scoring (7) | Core | 4 |
| Purchasing | ● RFQ → quotes → award → PO → approval → receipt → bill (Phase 4) | purchase requisitions | Suppliers, Inventory | 4 |
| Receiving | ● PO link, cost from PO, tolerance, lot/expiry, sorting reason (Phase 4) | gross/tare/net, QC hold | Purchasing, Quality | 4–5 |
| Quality | ◐ sorting at receipt; delivery exceptions (5) | inspections, QC hold — deferred by decision | Receiving | later |
| Logistics / delivery | ● trips, stops, POD, delivered/short/damaged/rejected qty, exceptions (5) | route optimisation | Fleet, Sales | 5 |
| Fleet | ◐ vehicles, drivers (5) | documents, maintenance (not needed yet) | Core, HR | 5 |
| Accounting | ● CoA, journals (DB-balanced, append-only), periods, automatic postings, stock valuation (6) | cost centres | Core, Currency, Tax | 6 |
| AR / AP / cash / bank | ● invoices, credit notes, bills, debit notes, receipts, payments, allocations, statements, aging, reconciliation foundation (3–6) | e-invoice format (awaiting reference) | Accounting | 6 |
| Tax / ETA e-invoice | ○ | VAT, adapter, submission state machine | Accounting, Integrations | 6/9 |
| Analytic accounting | ○ | dimensions on journal lines | Accounting | 6 |
| Finance / management | ◐ ops dashboards | margin, cash, KPIs | Accounting | 7 |
| Employees / expenses | ○ | profile, department, expense approval/posting | Approvals, Accounting | 8 |
| Integrations | ◐ one API key | per-integration credentials, intake staging, logs, retries | Core | 9 |
| Import / export | ○ | staged CSV/XLSX import with validation report | each module | per module |
| Reporting | ◐ ops | SQL-side aggregation, financial reports | all | continuous |

## 6. Critical technical debt

1. **Audit not atomic with the change it records** (`orders-service`): state update and
   `writeAudit` are separate statements. A failure between them leaves an unaudited
   change. `reopenOrder` additionally updates the order and its lines in separate
   statements. → fixed in Phase 1.
2. **Floating-point quantities.** Every weight is a double. Acceptable for kg at 3 dp
   today; unacceptable once money multiplies it. → Decimal migration in Phase 2 (stock)
   / 3 (orders), with money as Decimal from its first table. *Stock: done (Phase 2).*
3. **Business threshold in code** (`SHORTAGE_REVIEW_THRESHOLD_PCT = 5`), stall/waiting
   minutes as default parameters. → configuration service in Phase 1.
4. **`zod` is a dependency but unused**; validation is hand-written per service and
   inconsistent. → new modules use shared zod schemas.
5. **Malformed JSON bodies return 500** (`req.json()` throws). → shared body parser
   (`lib/http.ts`, Phase 1, done).
6. **Unbounded reads**: `listOrders`, `dailyProduction`, `dailyOperationsSummary`
   load every order ever created; `mapOrderProductName` / `unmapOrderProductName` load
   every order line to normalize names in JS. Fine at hundreds, wrong at 60 t/day for a
   year. (Fix: store the normalized name on `OrderItem` and query it.)
7. Stale comments: SQLite references in `schema.prisma`, `next.config.js`
   (`prisma/dev.db` watcher), orders-service; README vs `.env.example` disagree on the
   pooler port.
8. Login rate limiter is in-memory (documented; fine for one node).

## 7. Data integrity risks

| Risk | Severity | Mitigation |
|---|---|---|
| Duplicate order for one `external_id` if a write path bypasses the advisory lock | High | Partial unique index on `Order.externalId` (Phase 1), migration pre-checks for duplicates. |
| Unaudited mutation on partial failure | High | Atomic audit (Phase 1). |
| A malformed `delivery_date` / `delivery_time` passed the service and hit the DB CHECK → **500** (an integration reads that as "retry"); `""` as a time did the same | Medium | Service validation → 400; blank time stored as NULL (Phase 1, done). |
| Voiding or correcting a receipt downward could drive stock negative (only manual adjustments had the zero floor) | High | One `assertBalanceCovers` rule for every removal path (Phase 1, done). |
| Float accumulation in sums/yields | Medium | Stock: Decimal (Phase 2, done). Order quantities are still Float; they are rounded to 3 dp when issued, and convert with Phase 3. |
| Order lines with no canonical product cannot move stock | By design | Dispatch issues mapped lines and raises a `StockIssueException` for each unmapped / unconvertible / short line, so no gap is silent (Phase 2, done). |
| Vehicle / driver / customer are free text | Medium | Master data FKs added alongside the text (Phases 3, 5). |

## 8. Security risks

| Finding | Severity | Action |
|---|---|---|
| **Regression suites are written to run against the live database** (`reset-baseline` restores from a `supabase-snapshot-*` and deletes all products, suppliers, intakes and movements). Pointed at production it wipes the stock ledger. | **Critical (operational)** | Test-DB guard on every suite and reset; reset rebuilt from fixtures (Phase 1, done first). |
| Single shared integration key; compared with `!==` (not constant-time); no per-integration identity, rotation or logs | Medium | Constant-time compare (Phase 1, done); `IntegrationClient` with hashed keys in Phase 9. |
| Login timing differs for unknown vs known users (bcrypt only on known) | Low | Dummy hash compare on unknown users (Phase 1, done). |
| Changing a user's password does not end their existing sessions (JWT valid 12h; only `active` is re-checked) | Medium | Session epoch on `User`, embedded in the token and compared per request (Phase 1, done). |
| No CSP (documented decision) | Low | Revisit with nonce support. |
| No CSRF token; relies on `SameSite=Lax` + JSON content type | Low | Acceptable for same-origin JSON API; add Origin check in hardening. |
| No file upload yet | — | Document module must validate type/size, store outside web root, never trust client MIME. |
| Secrets: none committed; `.env*` ignored; prod refuses to boot without them | OK | — |

## 9. Migration risks

* The deployed database is real (Supabase). Every migration must be additive or carry an
  explicit, verified data transform; nothing here uses `db push` against it.
* New `NOT NULL` columns on existing tables need defaults or backfills in the same
  migration.
* Unique indexes on existing data (`externalId`) must abort with a clear message, not
  half-apply, if duplicates exist.
* The Float → Decimal change is the riskiest one in the plan: it changes the runtime type
  Prisma returns (`Decimal` objects), so every arithmetic site and JSON boundary changes.
  It is scheduled as its own phase with its own tests, not folded into feature work.
* Permission keys are stored in `UserPermissionOverride` rows; renaming a key orphans
  overrides. New keys are added; existing ones are kept.

## 10. Recommended target architecture

```
app/(ops)      tablet boards — prep, load, dispatch, receiving       (unchanged UX)
app/(back)     management screens — denser tables, filters, exports
app/api/v1/*   application API (session or integration auth)
lib/core/      settings, sequences, org master data, audit, approvals, notifications
lib/<module>/  domain services: inventory, sales, purchasing, quality, logistics,
               accounting, hr — each owns its tables, rules, transactions
lib/integrations/  adapters (n8n, email, WhatsApp, ETA) behind interfaces;
               normalized OrderIntake staging → Sales
PostgreSQL     FKs, CHECKs, partial uniques, append-only ledgers (stock, journal)
```

Principles carried forward from the existing code (they are the right ones):
services own rules and authorization; routes are transport; CAS on every write;
ledgers are append-only with derived balances; integrations fail closed; identity is
never guessed.

New principles:
* **One transaction per business action**, including its audit rows and ledger rows.
* **Money and weights are Decimal**; no JS float arithmetic on money.
* **Every policy number lives in configuration**, with a code default and an audit trail.
* **Documents have explicit lifecycles** (draft → confirmed → done / cancelled) enforced
  by one transition table per document type.
* **External systems never write business tables directly** — they write intake/staging
  rows that a service promotes.

## 11. Implementation sequence

Follows the directive's phase order. Each phase ships behind green suites.

* **Phase 1 — Foundation** *(in progress)*: test safety & foundation, atomic audit,
  configuration service, org master data (company / branch / warehouse / location /
  UoM / currency), integrity hardening, then sequences, approval engine,
  notifications, documents.
* **Phase 2 — Inventory core**: Decimal ledger, warehouse/location on movements,
  transfers, reservations, lots/expiry, FEFO/FIFO, valuation layer, stock reports.
* **Phase 3 — Sales**: customers, price lists, credit rules, quotation → sales order →
  reservation → existing fulfilment → delivered qty → returns.
* **Phase 4 — Purchasing**: supplier master, PR/RFQ/PO, receiving against PO.
* **Phase 5 — Operations**: QC, loading plan, trips, POD, fleet.
* **Phase 6 — Accounting**: CoA, journals, AR/AP, payments, tax, valuation posting.
* **Phase 7 — Finance / management dashboards.**
* **Phase 8 — HR / expenses.**
* **Phase 9 — Integrations** (email/WhatsApp intake pipeline, ETA adapter).
* **Phase 10 — Hardening.**
