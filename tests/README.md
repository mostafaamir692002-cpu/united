# UNITED test suites

Two layers.

| Layer | Command | Needs | What it covers |
|---|---|---|---|
| Unit | `npm run test:unit` | nothing | Pure business rules: shortage gate, workflow transitions, time thresholds, product-name normalization, settings validation, navigation. Runs in under a second. |
| End-to-end | `npm run test:e2e` | a running server + a **disposable** PostgreSQL | RBAC matrix, order lifecycle, stock ledger, product master, core (settings). Real HTTP, real database, real concurrency. |

`npm run test:all` runs both.

The end-to-end suites stay end-to-end on purpose: almost every bug they have caught
lived in the seam between the HTTP layer, the service layer and Postgres — RBAC
decisions, optimistic concurrency, pooler behaviour, ledger arithmetic — and none of
that is visible with the database mocked out.

## Safety: they refuse to run against anything that is not a test database

The suites create and delete rows, and `test:reset` truncates **every table**. Every
suite and the reset go through `tests/_guard.ts`, which refuses to run unless:

1. `UNITED_TEST_DB=1` is set — an explicit acknowledgement that the target is disposable;
2. `BASE` (for suites) and `DATABASE_URL` (for the reset) point at a local host.
   A remote target additionally needs `UNITED_TEST_ALLOW_REMOTE=1`, and a Supabase host
   needs `UNITED_TEST_ALLOW_SUPABASE=1`. Never set those for production.

## Running locally

```bash
# one-time: a local Postgres and a .env pointing at it
createdb united_test
# .env: DATABASE_URL / DIRECT_URL = postgresql://…@localhost:5432/united_test,
#       JWT_SECRET=<anything long>, N8N_API_KEY=<anything>

npx prisma migrate deploy
export UNITED_TEST_DB=1
npm run test:reset                         # truncate + load fixtures from prisma/seed.ts
npm run build && npx next start -p 3111 &  # or point BASE at any local instance
npm run test:all
```

`BASE` defaults to `http://localhost:3111`. Test scripts load `.env` automatically.

## Ground rules

- **The baseline is the fixtures in `prisma/seed.ts`**, rebuilt by `npm run test:reset`.
  It is reproducible from a fresh clone — no snapshot files, no production data.
- **Suites create their own data**, tagged (`ZZTEST-…`, `ZZCORE-…`) so leftovers are
  identifiable; run `test:reset` between runs if one aborts.
- **Never weaken an assertion to make a suite pass.** Every one of these encodes a rule
  somebody decided on purpose.
