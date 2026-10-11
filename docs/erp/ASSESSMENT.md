# UNITED ERP — Architecture Assessment

## Overview

UNITED is a single-codebase Next.js 14 ERP application for United Fresh Food Supply,
an Egyptian B2B produce supplier. It replaces Odoo with a purpose-built, tablet-first
operations + accounting system.

### Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Tailwind CSS, TanStack Query (3-5s polling) |
| **Backend** | Next.js 14 App Router (TypeScript strict) |
| **Database** | PostgreSQL via Prisma ORM |
| **Server** | Long-lived Node.js process (`next start`) |
| **Auth** | Custom JWT + bcryptjs + role/permission RBAC |
| **Storage** | Supabase Storage (prod) / Local (dev) |
| **Testing** | Built-in `node:test` + `tsx` for runtime suites |

## Architecture

```
USER (Browser / n8n / Hermes)
  │
  ├── Next.js App Router (route handlers)
  │       │
  │       ├── Auth guard (lib/authz.ts → lib/authz-core.ts)
  │       │   - Reads session JWT → resolves user from DB
  │       │   - Resolves effective permissions
  │       │   - Fails CLOSED: SUPER_ADMIN short-circuits
  │       │
  │       ├── Route handler (app/api/*/route.ts)
  │       │   - Validates input (Zod schemas)
  │       │   - Calls service function
  │       │   - Returns JSON response
  │       │
  │       └── Error handler (lib/rbac.ts)
  │           - ApiError → structured 4xx
  │           - Unknown error → 500 with ref ID
  │
  ├── Service layer (lib/*-service.ts)
  │   - All business logic, DB access, audit
  │   - Transaction boundaries (lib/tx.ts)
  │   - Advisory locks (lib/dbLock.ts)
  │   - Idempotency checks (lib/core/idempotency.ts)
  │
  └── Database (Prisma + PostgreSQL)
      - 90 models, 43 migrations
      - CHECK constraints, foreign keys, unique constraints
      - Append-only StockMovement ledger
      - Double-entry JournalEntry + JournalLine
```

## Database Design (90 Models)

### Master Data (10)
- Company → Branch → Warehouse → StorageLocation
- Currency, TaxRate, UnitOfMeasure
- StockProduct, ProductAlias, ProductPackaging

### Sales (12)
- Customer → CustomerAlias, CustomerContact
- PriceList → PriceListItem
- Quotation → QuotationLine
- SalesInvoice → SalesInvoiceLine
- CreditNote → CreditNoteLine

### Purchasing (12)
- Supplier → SupplierContact, SupplierPrice
- Rfq → RfqLine, RfqSupplier → SupplierQuoteLine
- PurchaseOrder → PurchaseOrderLine
- SupplierBill → SupplierBillLine
- DebitNote → DebitNoteLine

### Inventory (10)
- StockIntake, StockMovement (append-only ledger)
- StockLot, StockValuationLayer
- StockReservation, InventoryDocument
- StockIssueException, StockValuationPosting

### Operations (6)
- Vehicle, Driver, Trip → TripStop → DeliveryLine
- OperationalException

### Accounting (16)
- Account (chart of accounts), AccountingPeriod
- JournalEntry → JournalLine (double-entry)
- CashAccount
- CustomerReceipt → ReceiptAllocation
- SupplierPayment → PaymentAllocation
- BankReconciliation
- CustomerReceiptReversal, SupplierPaymentReversal
- CustomerRefund, SupplierRefund
- PartyOpeningBalance, StockValuationPosting

### HR (3)
- Department, Employee, EmployeeTransaction, Expense

### ETA E-invoicing (6)
- EtaIssuerProfile, EtaReceiverProfile
- EtaItemCode, EtaUnitType
- EtaDocument → EtaDocumentEvent

### Auth & System (10+)
- User, UserPermissionOverride, RolePermission, Permission
- LoginAttempt, AuditLog
- Integration, IntegrationLog
- ApprovalRequest, ApprovalDecision
- Notification, SystemSetting, NumberSequenceCounter
- Attachment

## Accounting Engine — Double-Entry

Every business document posts its own balanced journal entry, in the same transaction:

| Document | Accounting Treatment |
|---|---|
| Sales invoice | Dr AR (customer) / Cr Sales (net) / Cr VAT output |
| Credit note | Dr Sales returns / Dr VAT output / Cr AR (customer) |
| Supplier bill | Dr GRNI (agreed) ± PPV / Dr VAT input / Cr AP (supplier) |
| Debit note | Dr AP (supplier) / Cr GRNI ± PPV / Cr VAT input |
| Customer receipt | Dr Cash/Bank / Cr AR (customer) |
| Supplier payment | Dr AP (supplier) / Cr Cash/Bank |
| Stock valuation | Dr/Cr Inventory ↔ GRNI/COGS/Adjustments/Opening equity |
| Opening balance | Dr/Cr AR/AP / Cr/Dr Opening equity |
| Reversal | Exact opposite of the original entry |

**Invariants enforced:**
- Every posted entry balances (debits = credits) — checked at commit
- Posted entries cannot be modified or deleted (append-only)
- No posting into a closed period
- No posting to header accounts
- System keys ensure consistent posting accounts
- Stock valuation posts in the same transaction as the movement

## Stock Ledger — Append-Only

Current stock = SUM(quantity) over StockMovement. No stored balance.

- Never two writers race on "the current number" — there isn't one
- Every bucket (product + location + lot) checked ≥ 0 under per-bucket lock
- Locks taken in global order → concurrent postings queue instead of deadlocking
- Stock valuation posted in the same transaction → Dr Inventory / Cr GRNI/COGS
- No float arithmetic — all money in Prisma Decimal

## Security Model

- **Authentication**: JWT session cookie (`united_session`, HS256, 12h expiry)
- **Authorization**: Permission-based RBAC
  - Code is source of truth (`lib/permissions.ts`)
  - Database mirrors (auditable by SQL, but row edits never widen access)
  - Per-user overrides supported
  - SUPER_ADMIN short-circuits (cannot be locked out)
  - Session epoch: password change ends all existing sessions
- **7 roles**: SUPER_ADMIN, SUPERVISOR, STOCK_CONTROLLER, PREPARER, LOADER, SALES, ACCOUNTANT, PURCHASER
- **80+ permissions** across 13 groups