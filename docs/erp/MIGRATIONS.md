# UNITED ERP — Migration Guide

## Migration Strategy

UNITED uses Prisma Migrate with the Prisma schema as the single source of truth.

- All schema changes go through versioned migration files
- Never edit migration files retroactively
- Never use `db push` in production
- Apply migrations with `npx prisma migrate deploy`
- Rollback by deploying the previous application version

## Adding a Migration

```bash
npx prisma migrate dev --name <descriptive-name>
```

This creates a new migration in `prisma/migrations/` after reviewing the generated SQL.

## Applying Migrations to Production

```bash
# Requires DIRECT_URL (non-pooled port 5432)
npx prisma migrate deploy
```

## Checking Migration Status

```bash
npx prisma migrate status
```

## Rolling Back

Prisma Migrate does not support automated rollback. To revert:

1. Deploy the previous application version (which uses the old schema)
2. Run the SQL to revert changes manually, or restore from backup
3. Remove the problematic migration row from `_prisma_migrations`

## Producing a new SQL-only migration (when CI cannot run Prisma)

```bash
npx prisma migrate diff --from-migrations --to-schema-datamodel > migration.sql
```

## Backup Before Migration

```bash
# Using pg_dump
pg_dump --no-owner --no-acl -h <host> -p <port> -U <user> -d <database> -Fc > backup_$(date +%Y%m%d_%H%M%S).dump
```

## Test Database Setup

For e2e testing, use the disposable test database:

```bash
createdb united_test
UNITED_TEST_DB=1 npm run test:reset   # truncates + reseeds
npm run test:all                       # unit + e2e
```

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| DATABASE_URL | Yes | Pooled PostgreSQL connection |
| DIRECT_URL | No (migrations) | Direct (non-pooled) connection |
| JWT_SECRET | Yes | Session signing secret |
| N8N_API_KEY | No (integration) | n8n/Hermes order intake |
| SUPABASE_URL | No (attachments) | Supabase Storage URL |
| SUPABASE_SERVICE_ROLE_KEY | No (attachments) | Supabase Storage service key |
| STORAGE_PROVIDER | No | "local" (dev) / "supabase" (prod) |
| ETA_* | No | ETA e-invoicing credentials |