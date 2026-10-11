# UNITED ERP — Roadmap

## What Is Done (Implemented and Tested)

### ✅ Phase 1 — Operations Core (MVP)
- Order lifecycle: new → preparing → ready_for_loading → loading → loaded → dispatched → cancelled
- Preparation board (Tablet 1) — record prepared quantities
- Loading board (Tablet 2) — record loaded quantities, confirm dispatch
- Supervisor board — create/edit/approve/cancel/reopen/clone orders
- Daily production aggregation ("إنتاج النهارده")
- n8n/Hermes API key integration (`POST /api/orders`)
- Product master with alias resolution
- Order RBAC (PREPARER, LOADER, SUPERVISOR)
- Proven end-to-end: 2-tablet workflow verified

### ✅ Phase 2 — Stock & Inventory
- Stock intake with sorting/rejection tracking
- Append-only StockMovement ledger (current stock = SUM)
- Stock valuation at receipt (AVCO/FIFO/standard)
- Stock adjustments with approval thresholds
- Warehouse transfers
- Stock reservations and release
- Negative stock prevention (database CHECK + service layer)
- Stock issue exceptions (damaged, rejected)
- Product management (StockProduct + ProductAlias)
- Supplier management (stock side)

### ✅ Phase 3 — Sales (completed)
- Customer master with aliases and contacts
- Price lists with daily pricing
- Quotation → Convert to order → lifecycle
- Sales invoicing: issue invoices from orders
- Credit notes against invoices
- Customer credit management
- Tax configuration per product
- Customer statements and aging reports

### ✅ Phase 4 — Purchasing (completed)
- Supplier master with contacts and prices
- RFQ → Quote → Award workflow
- Purchase order lifecycle: draft → submit → send → receive → close
- Purchase order approval (above threshold)
- Three-way matching: PO × Receipt × Bill
- Supplier bills with GRNI/PPV posting
- Debit notes (goods returned / price allowance)
- Supplier statements and AP aging

### ✅ Phase 5 — Operations & Fleet
- Vehicles, drivers, trips
- Trip lifecycle: plan → start loading → loaded → dispatch → depart → complete
- Trip stops with delivery recording (delivered/partial/failed)
- Delivery lines with damage/rejection tracking
- Returns back to stock
- Operational exceptions with ownership and resolution

### ✅ Phase 6 — Accounting Core
- Chart of accounts with system keys
- Double-entry journal engine (balanced postings)
- Period control (open/close, sequential close)
- Manual journals with reversal
- Customer receipts with auto/explicit allocation
- Supplier payments with auto/explicit allocation
- Payment reversal (bounced cheque / returned transfer)
- Bank reconciliation
- Stock valuation posting to GL
- Idempotent document processing (request fingerprinting)
- EGP-only enforcement (foreign currency refused)
- Trial balance, account ledger
- Cash position report

### ✅ Phase 7 — HR / Expenses
- Departments and employees
- Expense recording with approval workflow
- Employee advances and reimbursements
- Ledger posting for all HR transactions

### ✅ Phase 8 — ETA E-Invoicing (Egypt)
- Full ETA submission pipeline
- Document mapping (Invoice v1.0)
- Issuer/receiver profiles
- Item codes (GS1/EGS)
- Unit type mapping
- Submission, refresh, reconcile
- Status tracking with event history

### ✅ Phase 9 — Data Onboarding
- CSV import with validation
- XLSX import with validation
- Opening stock import (products + quantities + costs)
- Opening customer/supplier balance import
- Opening accounting balance posting
- Validation and duplicate detection
- Controlled import with audit

### ✅ Phase 10 — System Infrastructure
- RBAC with 7 roles and 80+ permissions
- Permission sync between code and DB
- Approval engine (configurable thresholds)
- Operational settings (shortage tolerance, time thresholds)
- Notifications inbox
- Document attachments (local/Supabase storage)
- Integration management (n8n/Hermes API keys)
- Login rate limiting (5 attempts → 5 min lockout)
- Audit trail (all state-changing actions)
- Idempotency (request fingerprint + replay detection)
- Optimistic concurrency (version columns + advisory locks)
- Hot path indexes
- Connection pooling with Prisma

## What Remains

### P2 — Reporting Enhancements
- P&L and balance sheet report APIs (basic data exists in GL, need dedicated query)
- Stock valuation report API (exists, needs reconciliation assertions)
- VAT return summary (basic logic exists in vat-summary.ts, needs endpoint)
- Cancelled/reversed transaction report

### P3 — Improvements (Not Blocking Go-Live)
- Customer discount codes
- Batch/lot expiry alerting and automated quarantine
- Multi-currency support (not needed for UNITED — EGP-only is correct)
- Purchase requisition workflow (can use RFQ as proxy)
- Audit log search/filter UI

## Test Coverage

- **91 unit tests** — pure business rules (no database)
- **~5,500 E2E assertions** across 20+ test suites — real HTTP + real PostgreSQL
- **44 integration tests** — direct DB access for concurrency/idempotency scenarios
- **0 production database exposure** — test guard refuses non-local databases