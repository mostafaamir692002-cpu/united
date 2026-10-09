# UNITED — Production & Dispatch System → UNITED ERP

Internal tablet-first ops app connecting order intake (n8n/Hermes) → preparation →
loading/checking → dispatch, with a live dashboard as the single source of truth.

It is being evolved, phase by phase, into UNITED's ERP. Start with
[`docs/erp/ASSESSMENT.md`](docs/erp/ASSESSMENT.md) (architecture, gaps, plan),
[`docs/erp/ROADMAP.md`](docs/erp/ROADMAP.md) (what is done) and
[`docs/erp/MIGRATIONS.md`](docs/erp/MIGRATIONS.md) (how schema changes reach production).

## Stack (chosen for cost/simplicity, documented per the build brief)

- **Next.js 14 (App Router, TypeScript)** — one codebase for UI + API routes.
- **Prisma + PostgreSQL (Supabase)** — migrated from the original SQLite MVP store.
  `DATABASE_URL` is the pooled (Supavisor, 6543) connection the app uses at runtime;
  `DIRECT_URL` (5432) is what Prisma Migrate needs for DDL. Role/OrderStatus/ItemStatus
  remain plain strings validated in `lib/types.ts`, with CHECK constraints in the
  database backing the ones that matter for security and for the stock ledger.
- **Custom JWT cookie auth** (`lib/auth.ts`, `jose` + `bcryptjs`) with a
  **role + permission** authorization layer (`lib/permissions.ts`, `lib/authz.ts`) —
  no paid auth provider needed. The cookie proves identity; what the caller may do is
  resolved from the database on every request, so disabling an account or changing a
  role takes effect immediately with no session to expire.
- **Realtime via polling** (React Query, 3–5s `refetchInterval`) — the cheapest
  "live enough" mechanism for two tablets; no websocket infra to run/pay for.
  Swappable later for SSE/websockets by replacing the `useQuery` polling in
  `components/*/*.tsx` — nothing else changes.
- **Optimistic concurrency**: every `Order`/`OrderItem` has a `version` column,
  checked server-side (`lib/orders-service.ts: assertVersion`) on every mutation.
  A stale write gets `409` with the current version so the client can refresh
  instead of silently clobbering another tablet's change.
- **Immutable audit log** (`AuditLog` model) — every state-changing action is
  recorded with who/what/when/why/source; no update/delete path is exposed for it.

## Run it (local development)

```bash
npm install
cp .env.example .env    # then fill in the real values
npm run db:generate     # generate the Prisma client
npx prisma migrate deploy   # apply migrations to the database in DATABASE_URL
npm run dev
```

Open http://localhost:3000 — it redirects to `/login`.

> `npm run db:push` and `npm run db:seed` are **local/scratch tooling only**.
> `db:push` bypasses the migration history, and `db:seed` writes demo users and
> demo orders. Never point either at a production database — use
> `npx prisma migrate deploy` there, which is the only path that keeps
> `_prisma_migrations` honest.

## Deploy it (production)

This runs as a **single long-lived Node server**, not serverless — that is what the
session-mode pooler and the connection budget in `.env.example` assume.

```bash
npm ci                       # reproducible install from package-lock.json
npm run db:generate          # Prisma client for this schema
npx prisma migrate deploy    # apply pending migrations (needs DIRECT_URL)
npm run db:sync-permissions  # mirror the code permission catalogue into the DB
npm run build                # production build (NODE_ENV=production)
npm run start                # serve; keep alive under a supervisor
```

Run `npm run start` under a process supervisor (systemd, pm2, Docker restart
policy) behind a TLS-terminating reverse proxy. Requirements:

- **`NODE_ENV=production`** — `next start` sets it. Secure cookies, HSTS and the
  missing-secret refusal in `lib/env.ts` all key off it.
- **HTTPS is mandatory.** The session cookie is `Secure` in production, so the app
  cannot log anyone in over plain HTTP (localhost excepted).
- **Health check:** `GET /api/health` → `200 {"status":"ok"}`, or `503` when the
  database is unreachable. Point the supervisor/proxy at it.
- **Secrets:** see `.env.example`. A missing `DATABASE_URL` or `JWT_SECRET` makes
  the server refuse to serve rather than fall back to an insecure default.

Demo accounts exist only in `prisma/seed.ts` (local seeding, password `1234`):

| Username | Role             | Home          |
|----------|------------------|---------------|
| admin    | SUPER_ADMIN      | `/admin`      |
| sara     | SUPERVISOR       | `/supervisor` |
| hossam   | STOCK_CONTROLLER | `/stock`      |
| ahmed    | PREPARER         | `/prep`       |
| mostafa  | LOADER           | `/load`       |

**Before real users touch production**, change every seeded password (Admin →
المستخدمين → تعديل). The minimum is 8 characters and login locks an account for
5 minutes after 5 failed attempts.

## Structure

```
app/
  login/                    login page
  prep/                     Tablet 1 — preparation board + order detail
  load/                     Tablet 2 — loading/checking board + vehicle manifest
  production/               "إنتاج النهارده" daily aggregation
  supervisor/                all-orders board, create order, full audit log
  supervisor/[orderId]/      edit/approve/cancel/reopen/override + timeline
  api/                       route handlers (see contract below)
lib/
  orders-service.ts          all order/item mutation logic + audit writes
  stock-service.ts           stock intake + append-only inventory ledger
  admin-service.ts           user administration, role changes, permission overrides
  orderWorkflow.ts           allowed status transitions per role
  permissions.ts             the permission catalogue and role bundles (source of truth)
  authz.ts                   the single permission resolver + route/page/service guards
  nav.ts                     one navigation definition, filtered by effective permissions
  rbac.ts                    ApiError / handleApiError
  auth.ts / api-auth.ts      session cookie + n8n API-key auth
  config.ts                  shortage/needs_review threshold (tunable)
  product-validation.ts      plug point for the future Google Sheets Product Master
prisma/schema.prisma         data model
```

## RBAC (enforced server-side, not just hidden in the UI)

Authorization is **role + permission**. A user has one role, a role carries a bundle of
permissions, and a user may additionally be granted or denied individual permissions.
Effective permissions = the role's bundle + that user's grants − that user's revokes.

Everything resolves through one mechanism (`lib/authz.ts`): API routes, service
actions, page guards and navigation. Nothing decides access from a role string. Hiding
a link is never the protection — every endpoint behind it re-checks independently, and
an unauthenticated call gets `401` while an authorized-but-insufficient one gets `403`.

The catalogue and the bundles live in `lib/permissions.ts` (code is the source of
truth) and are mirrored into `Permission`/`RolePermission` by
`npm run db:sync-permissions`, so permissions can be audited with plain SQL but a row
edit can never widen access on its own.

- **PREPARER** — `orders.view`, `orders.prepare`.
- **LOADER** — `orders.view`, `orders.load`, `orders.dispatch`.
- **STOCK_CONTROLLER** — the six `stock.*` permissions; no access to orders at all.
- **SUPERVISOR** — all `orders.*` and `stock.*`, plus `reports.view` and `audit.view`.
- **SUPER_ADMIN** — everything, including `users.*` and `settings.manage`. This role
  short-circuits to every permission and ignores overrides, which is what makes it
  impossible to lock every administrator out through the permissions UI. The system
  also refuses to disable or demote the last active SUPER_ADMIN.

Workflow rules are separate from permissions and still apply: `lib/orderWorkflow.ts`
governs which status transitions are legal from which state, and forcing a non-standard
one requires `orders.edit` plus a typed reason, and is audited as `status_override`.

`/admin` is the SUPER_ADMIN dashboard: users list, create/edit, enable/disable, change
role, effective permissions per user, per-user overrides, the full role/permission
matrix, a system access overview, and the security audit trail. Every user-management
change (created, enabled, disabled, role changed, permission granted/revoked/cleared)
is audited with actor, target, old value, new value and timestamp.

## Order lifecycle

`new → preparing → ready_for_loading → loading → loaded → dispatched`, plus
`cancelled` (terminal, never deleted — see `cancelOrder`). Flags `shortage` and
`needsReview` are recomputed on every quantity write (`lib/config.ts`); if the
required/actual gap exceeds the `orders.shortage_review_threshold_pct` setting
(default 5%), the order is blocked from advancing until a supervisor approves it.

## Configuration

Operational policy numbers are settings, not constants: the shortage tolerance and the
waiting / stalled / delivery-soon thresholds. `lib/core/settings-registry.ts` defines
each one (type, bounds, default, Arabic label); the `SystemSetting` table stores only
values someone changed. Admin → **إعدادات التشغيل** (`settings.manage`) edits them with
a mandatory reason; every change is versioned (409 on a stale edit) and audited.
Boards read them from `GET /api/settings/operational`.

## Organisation master data

Company → branch → warehouse → storage location (cold rooms, zones, receiving and
dispatch bays), units of measure and currencies live in the database
(`lib/core/org-service.ts`), managed from Admin → **الشركة والمخازن والوحدات**
(`core.masterdata.manage`). The site's physical figures — area, daily throughput,
cold-room capacity and temperature band — are data, not constants. Codes are fixed
once created, nothing is deleted (rows are deactivated, parents only once their
children are), and every write is versioned and audited. Operational screens read the
active lists from `GET /api/core/reference`. Weight/volume/count units convert exactly
(`lib/core/uom.ts`, Decimal arithmetic); package units such as crates convert per
product.

## n8n / Hermes API contract

`POST /api/orders` — header `x-api-key: <N8N_API_KEY>` (see `.env`), idempotent
on `external_id` (a retried webhook won't create a duplicate order — enforced by a
unique index as well as by the service). `delivery_date` must be a real calendar day
`YYYY-MM-DD` and `delivery_time`, when given, 24-hour `HH:mm`; anything else is a `400`
(it used to surface as a `500`). A malformed JSON body is a `400`.

```json
{
  "external_id": "email-123",
  "customer_name": "Hotel X",
  "delivery_date": "2026-09-10",
  "delivery_time": "08:00",
  "notes": "",
  "source": "n8n",
  "items": [{ "product_id": "123", "product_name": "Mango", "quantity": 25, "unit": "KG" }]
}
```

Other endpoints (all require the caller's session cookie; role checks above apply):

| Method & path | Purpose |
|---|---|
| `GET /api/orders?status=new,preparing&date=YYYY-MM-DD` | list/filter orders |
| `GET /api/orders/:id` | order + items |
| `PATCH /api/orders/:id` | supervisor edit (customer/delivery/notes/vehicle), needs `reason` |
| `POST /api/orders/:id/status` | move status `{ to, reason?, expected_version }` |
| `POST /api/orders/:id/items/:itemId/prepare` | `{ quantity?, mark_done?, expected_version }` |
| `POST /api/orders/:id/items/:itemId/load` | `{ quantity?, mark_done?, expected_version }` |
| `POST /api/orders/:id/items/:itemId/required` | supervisor-only, needs `reason` |
| `POST /api/orders/:id/approve` | clear `needsReview`, needs `reason` |
| `POST /api/orders/:id/cancel` | needs `reason` |
| `POST /api/orders/:id/reopen` | needs `reason` |
| `GET /api/production/daily?date=YYYY-MM-DD` | per-product totals for the day |
| `GET /api/audit?orderId=...` | one order's timeline (any authenticated role) |
| `GET /api/audit` | full log (supervisor only) |
| `GET /api/settings/operational` | operational thresholds (any signed-in user) |
| `GET /api/admin/settings` · `PATCH /api/admin/settings/:key` | list / change a setting (`settings.manage`; `{ value, reason, expected_version }`, `value: null` resets) |

Every write returns `409` with the current `version` if `expected_version` is
stale — the caller should refetch and retry, not force the write.

## Product Master

One canonical identity per product (`StockProduct`), and every string that
legitimately means it (`ProductAlias`). `lib/product-validation.ts` resolves each
incoming order line through it on creation, and `OrderItem.stockProductId` holds
the canonical link — `NULL` means UNMAPPED.

Matching is **exact only**, on a documented normalization
(`lib/productIdentity.ts`): NFKC, Arabic diacritics/alef/ta-marbuta folding,
Arabic-Indic digits, separator collapsing. There is no fuzzy matching, no edit
distance and no AI guessing — a name either resolves to something the master
already knows, or a human decides. `ProductAlias.normalized` is unique across the
whole table, so a lookup can never have to choose between two products, and the
resolver still refuses if it ever finds more than one.

An unrecognised product **never blocks an order**: the line is recorded exactly as
sent and surfaces in the coverage view (`/stock/setup` → الربط) as mapped /
unmapped / ambiguous for a stock controller to link by hand. Linking is audited.

Stock deduction is deliberately **not** wired up: mapping establishes identity
only, and moves no quantities.

## Tests

`npm run test:unit` (pure rules, no database) and `npm run test:e2e` (real server, real
PostgreSQL). The end-to-end suites and `npm run test:reset` **refuse to run** unless
`UNITED_TEST_DB=1` is set and the target is local — see [`tests/README.md`](tests/README.md).

## Tested flow (see section 19 of the brief)

Verified end-to-end during implementation, both through the UI (two browser
tabs as two tablets, one logged in as `ahmed`, one as `mostafa`) and via direct
API calls with curl:

1. Order created via `POST /api/orders` with the n8n API key.
2. It appeared on the preparer's board within one poll interval — no manual refresh.
3. Preparer opened it; entering a prepared quantity auto-started `preparing`.
4. Marked both items prepared; a seeded order with a real shortfall (14/20 KG)
   correctly flagged `⚠️ فيه صنف ناقص` and `needsReview`.
5. Supervisor approved the shortage with a reason; the flag cleared and it was
   logged in the timeline ("المشرف اعتمد الفرق").
6. "الأوردر خلص" moved it to `ready_for_loading`.
7. It appeared on the loader's board immediately (same polling mechanism).
8. Loader entered loaded quantities, including one below the prepared amount —
   flagged the shortage warning again at the loading stage.
9. All items confirmed → "تم التحميل" → order became `loaded` and appeared in
   the vehicle manifest.
10. "العربية جاهزة" dispatched it → `dispatched`.
11. The order's timeline showed every step with actor, Arabic label, and reason
    where applicable.
12. `curl` as a PREPARER against the loader-only `/load` endpoint → `403`,
    confirming RBAC is enforced server-side, not just hidden in the UI.
13. Two writes against the same item with the same stale `expected_version` →
    first succeeds, second returns `409` with the current version — confirms
    two tablets can't silently overwrite each other.

## Explicitly out of scope for this MVP

Full ERP/accounting, customer portal, delivery tracking, and the actual
WhatsApp/Hermes/Google-Sheets integrations — those have stable plug points
(`source` field, `product-validation.ts`, the n8n API contract above) but are
not implemented here.
