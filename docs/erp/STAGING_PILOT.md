# UNITED ERP — Controlled Staging Pilot Preparation

**Status:** PLAN ONLY — not executed  
**Date prepared:** 2026-10-18  
**Current code:** `united-full-project`@`7bccad7425…a103`  
**Production:** untouched, unauthorized.

---

## 1. Staging Deployment Plan

### 1.1 Target

| Attribute | Value |
|---|---|
| Server | erp.united-ffv.com (186.240.152.101) |
| Application dir | `/opt/united-staging` (separate from production `/root/united`) |
| Port | **3111** (must not conflict with production 3000) |
| Database | Local PostgreSQL on port **5433** named `united_staging` — same host as dev, different DB name, isolated |
| Reverse proxy | Nginx Proxy Manager — add a new Proxy Host for staging subdomain |
| DNS | `staging.united-ffv.com` (CNAME to 186.240.152.101) |

### 1.2 Prerequisites (on the VPS)

- [ ] Node.js ≥ 18, npm
- [ ] PostgreSQL on 5433 with `united_staging` database created
- [ ] Git clone of the current repo into `/opt/united-staging`
- [ ] The VPS user has read access to the private repo (use deploy key)
- [ ] A separate `.env` for staging (never reuse production `.env`)

### 1.3 Deployment Steps

```bash
# 1. Checkout the release commit
cd /opt/united-staging
git checkout 7bccad7425  # or the tag assigned at deployment time

# 2. Create staging .env (see §2 for variable inventory)
#    !! Never copy production .env — copy the template below

# 3. Install dependencies
npm ci --omit=dev

# 4. Apply database migrations (uses DIRECT_URL)
npx prisma migrate deploy

# 5. Sync permissions
npm run db:sync-permissions

# 6. Build
npm run build

# 7. Start with process manager (e.g. systemd, supervisor, or screen)
#    Using the same start-dev pattern but on port 3111:
npx next start --port 3111
```

### 1.4 Rollback

```bash
# 1. Stop the staging process
# 2. Deploy the previous release:
cd /opt/united-staging && git checkout <previous-tag>
npm ci --omit=dev && npm run build && npx next start --port 3111

# Migrations are additive only — rollback deploys the old app code.
# If a migration must be reverted, restore from backup:
pg_restore --no-owner -d united_staging united-YYYY-MM-DD.dump
```

---

## 2. Environment Variable Inventory

| Variable | Required | Purpose | Staging value |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Pooled connection (through PgBouncer or direct) | `postgresql://user:pass@localhost:5433/united_staging` |
| `DIRECT_URL` | ✅ for migrations | Direct DDL connection | `postgresql://user:pass@localhost:5433/united_staging` |
| `JWT_SECRET` | ✅ | Session signing — **unique per environment, never shared** | Generate: `openssl rand -hex 32` |
| `N8N_API_KEY` | ❌ (legacy) | n8n/Hermes key — staging uses its own key | `staging-n8n-key-<random>` |
| `UNITED_STAGING` | ✅ | Staging guard: prevents accidental production DB writes | `1` |
| `STORAGE_PROVIDER` | ❌ | `local` for staging (no Supabase dependency) | `local` |
| `SUPABASE_URL` | ❌ | Attachment storage (Supabase) | (empty for local) |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | (empty for local) |
| `ETA_ENV` | ❌ | `preprod` for staging | (empty until ETA test) |
| `ETA_API_BASE_URL` | ❌ | (empty until ETA test) |
| `ETA_CLIENT_ID` | ❌ | (empty until ETA test) |
| `ETA_CLIENT_SECRET` | ❌ | **Never hardcoded** | (empty until ETA test) |
| `ETA_SIGNER_URL` | ❌ | (empty until ETA test) |
| `ETA_SIGNER_TOKEN` | ❌ | (empty until ETA test) |

**Secrets never logged, never returned by API, never in `.env` committed to git.**  
The `.env` file must be created manually on the VPS.

Staging **should not** have ETA credentials — it will verify that ETA submission is correctly refused (503) when unconfigured, exactly as the ETA test suite asserts.

---

## 3. Accounting Decision — Required Accountant Approval

### 3.1 The Unknown-Cost Gap

When UNITED receives fresh-produce stock **before the supplier price is known**, the system records the receipt at **zero cost** with flag `receivedWithoutCost`. When the stock is sold before the supplier bill arrives, the COGS is **zero** and the margin is flagged as `costUnknownQty` in the finance report.

When the supplier bill eventually arrives at the real price, the journal posted is:

| Account | Debit | Credit | Description |
|---|---|---|---|
| 5300 (PPV — Purchase Price Variance) | 4,000 EGP | — | The full real cost (receipt carried at 0) |
| 2100 (AP — Accounts Payable) | — | 4,000 EGP | Supplier liability |
| 2150 (GRNI — Goods Received Not Invoiced) | — | — | **Zero** — nothing was recognized at an agreed price |

**GRNI stays 0** because the receipt was valued at 0 (unknown cost at the time). There is no "agreed price" to reverse from GRNI. The full cost lands in **purchase-price variance (PPV)**, a period expense account.

The remaining stock layer (300 kg in the tested scenario) **keeps its 0 valuation** — posted history is never silently rewritten. The `receivedWithoutCost` flag and the `costUnknownQty` finance-report flag persist for reconciliation.

### 3.2 Consequence

| Item | Effect |
|---|---|
| P&L: revenue | 21,000 EGP (correct) |
| P&L: COGS | 0 EGP (the sold units left at 0/unknown) |
| P&L: PPV expense | 4,000 EGP (the real supplier cost recognized here) |
| P&L: net effect | Revenue − PPV = 17,000 — the cost IS in the P&L, but not in the margin-by-product report |
| Balance sheet: inventory | 300 × 4 EGP ≠ 0 — **understated** until the remaining layer is explicitly corrected |
| Balance sheet: AP | +4,000 EGP (correct) |
| Balance sheet: GRNI | 0 EGP (correct — the receipt was at 0, so nothing to reverse) |

### 3.3 Decision Required

> **"Does the treatment of unknown-cost receipts match UNITED's accounting policy?"**

**Option A — Accept the current design** (PPV absorbs the full cost, inventory stays flagged):
- Works today. The flag remains visible for reconciliation.
- Remaining stock stays at 0 until (a) the accountant posts a manual stock revaluation via adjustment, or (b) the goods are consumed and the PPV expense captures the true cost in the period.
- **Consequence:** inventory valuation may be understated between the bill date and the adjustment date. The P&L is correct overall (cost recognized via PPV), but the product-margin report shows provisional figures permanently for those historical sales.

**Option B — Require the intake's unit cost to be updated before the bill** (set the supplier price immediately at receipt):
- Works today: enter `unit_cost` on the intake form. The valuation layer gets `purchase` cost, and the bill posts `Dr GRNI agreed / Dr PPV variance / Cr AP` — the standard flow.
- **Consequence:** depends on warehouse staff entering the price at receipt time or the purchasing team having the price by then.

**Status:** awaiting Accountant's written confirmation. No code changes will be made based on assumptions.

The test proving this behavior is `tests/cost-reconciliation.test.ts` (21 assertions, 0 failures).

---

## 4. Staff UAT Acceptance Matrix

### 4.1 Warehouse (حسام — STOCK_CONTROLLER)

| # | Test | Role | Expected | Actual | Pass? |
|---|---|---|---|---|---|
| W1 | Log in with valid password | حسام | 200, dashboard loads | — | NOT RUN |
| W2 | Log in with wrong password 5× | حسام | Locked out after 5 attempts | — | NOT RUN |
| W3 | Record an intake with grading (good + gradeB + waste + rejected) | حسام | 201, splits correctly, locations correct | — | NOT RUN |
| W4 | Record an intake without unit cost | حسام | 201, cost flagged as unknown | — | NOT RUN |
| W5 | Transfer stock cold→cold | حسام | 201, balance unchanged | — | NOT RUN |
| 
| W6 | Stock count: manual count with variance | حسام | Count variance triggers approval if above threshold | — | NOT RUN |
|---|---|---|---|---|---|
| W7 | Customer return (30 kg against an order) | حسام | 201, stock back | — | NOT RUN |
| W8 | Customer over-return (110 kg against a 100-kg dispatch) | حسام | 409 — capped | — | NOT RUN |
|---|---|---|---|---|---|--|
| W9 | Supplier return (within received quantity) | حسام | 201, stock leaves | — | NOT RUN |
|---|---|---|---|---|---|
| W10 | Reversal of any document | حسام | Negating movements reverse the effect | — | NOT RUN |
|---|---|---|---|---|---|
| W11 | View inventory ledger | حسام | 200, signed quantities | — | NOT RUN |
|---|---|---|---|---|---|
| W12 | View inventory valuation (costs) | حسام | 200 *or* 403 depending on permission | — | NOT RUN |
|---|---|---|---|---|---|
| W13 | Check Arabic UI: labels, errors, RTL tables, number formatting | حسام | All readable in Arabic | — | NOT RUN |
|---|---|---|---|---|---|
| W14 | Print a stock receipt / transfer note | حسام | RTL, bilingual, correct figures | — | NOT RUN |
|---|---|---|---|---|---|
| W15 | Use on a tablet/mobile | حسام | Forms usable (zoom, tap targets adequate) | — | NOT RUN |

### 4.2 Sales (منى — SALES)

| # | Test | Role | Expected | Actual | Pass? |
|---|---|---|---|---|---|
| S1 | Log in | منى | Sales dashboard | — | NOT RUN |
| S2 | Create a quotation for a hotel customer | منى | 201 with quoted prices | — | NOT RUN |
| S3 | Convert quotation to order | منى | 201, order created with all lines | — | NOT RUN |
|---|---|---|---|---|---|
| S4 | Create an order (items, delivery dates) | منٰى | 201 | — | NOT RUN |
|---|---|---|---|---|---|
| S5 | List orders, check status | منى | 200, filterable | — | NOT RUN |
|---|---|---|---|---|---|
| S6 | Raised RBAC: try to access purchasing, accounting, stock, admin | منى | 403 | — | NOT RUN |
|---|---|---|---|---|---|
| S7 | Arabic UI check | منى | Labels in Arabic | — | NOT RUN |

### 4.3 Purchasing & Warehouse Receiving

| # | Test | Role | Expected | Actual | Pass? |
|---|---|---|---|---|---|
| P1 | Create a purchase order | أحمد (PREPARER) | 403 (purchaser only) | — | NOT RUN |
| P2 | Create a supplier | حسام | 201 | — | NOT RUN |
| P3 | Raise RBAC: stock controller tries purchasing | حسام | 403 | — | NOT RUN |
| P4 | View purchase order list | المشتري | 200 | — | NOT RUN |

### 4.4 Accounting (كريم — ACCOUNTANT)

| # | Test | Role | Expected | Actual | Pass? |
|---|---|---|---|---|---|
| A1 | Trial balance | كريم | Balanced | — | NOT RUN |
| A2 | P&L by product | كريم | Shows provisional margin flag | — | NOT RUN |
| A3 | Customer statement (hotel) | كريم | Closing balance = opening + invoices − receipts | — | NOT RUN |
| A4 | Supplier statement (farm) | كريم | Same | — | NOT RUN |
| A5 | AR aging | كريم | Buckets match statement totals | — | NOT RUN |
| A6 | Period close | كريم | Locked month -> 409 on new JEs | — | NOT RUN |
| A7 | Open/close cycle | كريم | Clean reopen | — | NOT RUN |
| A8 | Manual journal → reversal | كريم | Reversal documented, linked | — | NOT RUN |
| A9 | Cancelled report | كريم (senior) | 200, entries + totals | — | NOT RUN |
| A10 | Sales cannot see cancelled report | منى | 403 | — | NOT RUN |

### 4.5 Management & Administration

| # | Test | Role | Expected | Actual | Pass? |
|---|---|---|---|---|---|
| M1 | Finance report (margin by product) | كريم | Revenue, COGS, costUnknownQty present | — | NOT RUN |
| M2 | Export finance report CSV | كريم | UTF-8 BOM, all rows, opens in Excel | — | NOT RUN |
| M3 | Admin: create/edit user | ADMIN | 200 | — | NOT RUN |
|---|---|---|---|---|---|---|
| M4 | Admin: disable a user | ADMIN | User locked immediately | — | NOT RUN |
|---|---|---|---|---|---|
| M5 | ETA overview (unconfigured) | كريم | 200, shows missing variable names | — | NOT RUN |
|---|---|---|---|---|---|
| M6 | ETA overview (non-finance) | منى | 403 | — | NOT RUN |

---

## 5. Staging Go/No-go Checklist

| # | Criterion | Verification | Result |
|---|---|---|---|
| 1 | All 21 canonical test suites pass (canonical e2e chain) | Run `npm run test:e2e` on the *staging server* (not local dev) | — |
| 2 | Unit tests pass (92/92) | `npm run test:unit` | — |
| 3 | Integration tests pass (62/62) | `npm run test:integration` | — |
| 4 | TypeScript check clean | `npx tsc --noEmit` exit 0 | — |
| 5 | Production build succeeds | `npm run build` exit 0 | — |
|---|---|---|---|
| 6 | Account health all green | GET /api/accounting/integrity | — |
|---|---|---|---|
| 7 | Trial balance balanced | GET /api/accounting/trial-balance | — |
|---|---|---|---|
| 8 | Backup taken before deploying staging | `pg_dump` of the empty staging DB | — |
|---|---|---|---|
| 9 | No demo accounts present | Login as `admin`/`password=1234` → 401 | — |
|---|---|---|---|
| 10 | SMS/ECT staging phantom variable: `UNITED_STAGING=1` set | env check | — |
|---|---|---|---|
| 11 | All role logins work with staff-assigned passwords | Each staff role: login → dashboard | — |
|---|---|---|---|

**Go for staff pilot** = all 11 pass.

## 6. Production Go/No-go Checklist (use after pilot, before production deployment)

| # | Criterion | Owner | Result |
|---|---|---|---|
| 1 | Staging pilot ran ≥ 2 weeks with staff sign-off | Staff UAT | — |
|---|---|---|
| 2 | No P1 or P2 defect open against the deployed version | QA | — |
|---|---|---|---|---|
| 3 | ETA sandbox executed and signed off | Accountant + IT | — |
|---|---|---|---|
| 4 | Backup: production restore drill passed (bit-identical) | IT | — |
|---|---|---|---|
| 5 | Accountant approves: (a) opening balances, (b) PPV cost treatment, (c) GRNI policy | Accountant | — |
|---|---|---|---|
| 6 | Payroll handling decision documented and communicated | Management | — |
|---|---|---|---|
| 7 | Production env vars set, secrets rotated (staging → production) | IT | — |
|---|---|---|---|
| 8 | `npx prisma migrate status` shows no unapplied migrations | IT | — |
|---|---|---|---|
| 9 | Permission sync run: `npm run db:sync-permissions` | IT | — |
|---|---|---|---|
| 10 | First production backup taken after go-live | IT | — |
|---|---|---|---|
| 11 | Odoo set to read-only for migrated scope | Management | — |
|---|---|---|---|
| 12 | Cut-over reconciliation: trial balance matches Odoo at cut-off | Accountant | — |

**Go for production** = all 12 pass.

---

## 7. Evidence Capture Template

Each staff UAT session logs:

```
Role: _________
Tester: _________
Date: _________

# | Result (PASS/FAIL/BLOCKED) | Notes (observed behavior, screenshot ref, error text)
--|---------------------------|----------------------------------------------------
1 | _________________________ | ________________________________________________
2 | _________________________ | ________________________________________________
...

Defects found:
- (describe, with steps to reproduce)
Unexpected behavior observed (not a defect, but notable):
- (describe)
Approved by (tester): _________

Scanned evidence files (screenshots, exports, PDFs):
- screen-01.png : intake grading form
- screen-02.png : inventory ledger
...
```

---

## 8. Production Untouched Confirmation

| Item | Status |
|---|---|
| Production database | **Not accessed** |
| Production API endpoints | **Not called** |
| Production credentials/secrets | **Not copied into staging docs** |
| Git push/commit | **Not executed** |
| Production deployment | **Not authorized, not performed** |
| Staging deployment | **NOT YET EXECUTED** — requires owner approval of this plan |

**This document is a plan only.** Each step requires explicit authorization before execution.