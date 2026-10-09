# Development / test accounts

**DEVELOPMENT AND TEST ONLY.** These accounts are written by `prisma/seed.ts` (`npm run
db:seed`, and by `npm run test:reset` into the local test database). The seed refuses a
Supabase-hosted `DATABASE_URL` unless `ALLOW_DEMO_SEED=1` is set on purpose. Their
password `1234` is shorter than the policy minimum (8) — the seed writes it directly so
the test suites can sign in; no real account can be given such a password through
the app. Never create these on production.

| Username | Role | Password | Main purpose |
|---|---|---|---|
| `admin` | SUPER_ADMIN | `1234` | Everything: users, roles, permission overrides, settings, master data, every module |
| `sara` | SUPERVISOR | `1234` | Runs the floor: orders, preparation/loading/dispatch, all stock operations, approves shortages and large adjustments, sees stock value, reads customers, prices and quotations, operations reports, audit |
| `hossam` | STOCK_CONTROLLER | `1234` | Stock only: receive, sort, transfer, count/adjust, scrap, returns, lots, reservations, products and suppliers, dispatch exceptions |
| `ahmed` | PREPARER | `1234` | Preparation queue: enter prepared quantities, mark lines done |
| `mostafa` | LOADER | `1234` | Loading queue, loaded quantities, dispatch with driver/vehicle/crates |
| `mona` | SALES | `1234` | Customers, contacts, aliases, mapping order names, order entry, price lists and daily prices, price overrides, quotations, reads invoices |
| `karim` | ACCOUNTANT | `1234` | Credit terms and credit approvals, invoices and credit notes, statements, aging, tax classification, stock value, audit; approves POs above the threshold; books supplier bills and debit notes (cannot approve bill variances) |
| `omar` | PURCHASER | `1234` | Suppliers and their prices, RFQs and quotations, purchase orders (create, submit, send, close); reads stock, bills and payables |

What each role may and may not do is generated from the code in
[`RBAC_MATRIX.md`](RBAC_MATRIX.md) (roles × permissions, pages, every API handler) and
verified end to end by `tests/security.test.ts`.

## What each role must NOT be able to do (verified)

| Role | Refused (server-side, 403) |
|---|---|
| SUPERVISOR | users, roles, permission overrides, system settings, master data; customer credit; price changes; invoices; tax classification |
| STOCK_CONTROLLER | everything outside stock; stock **value and costs** (redacted from every stock response); approving adjustments (its own or anyone's); customers, credit, prices |
| PREPARER | anything but the preparation queue and reading orders; prices, credit details and commercial events are absent from the orders and timelines it reads |
| LOADER | same as preparer, for loading/dispatch |
| SALES | stock (levels, receiving, transfers, adjustments); credit terms; invoicing; tax classification; users and settings |
| ACCOUNTANT | moving orders or stock (prepare, load, dispatch, receive, adjust); operations reports; users and settings; approving supplier-bill variances |
| PURCHASER | approving purchase orders; receiving stock; booking supplier bills; sales, customers and orders |
