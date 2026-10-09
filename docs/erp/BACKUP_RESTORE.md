# Backup and restore — verified procedure

*Drill performed 2026-10-09 on disposable databases only (never production): the local
test database, full of data from the complete suite and the UAT, was backed up, restored
into a brand-new database, and verified at database level and through the application.*

## What holds business state

| Store | Holds | Backed up by |
|---|---|---|
| PostgreSQL | Everything: master data, documents, stock ledger, lots, journals, audit, ETA state, settings, users | Supabase point-in-time recovery + a daily `pg_dump` kept off-site |
| Supabase Storage bucket | Attachment files (PDF, photos) | Bucket backup / replication (files are never stored in the database) |

Nothing else holds state: the app servers are stateless (sessions are signed tokens) and
can be rebuilt from the repository.

## Backup

```
pg_dump --format=custom --no-owner "$DIRECT_URL" > united-$(date +%F).dump
```

Keep at least 30 daily dumps off-site. A dump is consistent: `pg_dump` reads one snapshot,
so a backup taken while people work is still internally balanced.

## Restore drill (before go-live, then quarterly)

Always into a **new** database. Never restore over production.

```
# 1. Fingerprint the running source (read-only).
VERIFY_USER=<admin> VERIFY_PASSWORD=<…> npx tsx scripts/ops/restore-check.ts fingerprint https://<production> > fp-source.json

# 2. Restore the dump into a NEW, empty database.
createdb united_restore            # or a new Supabase project / branch
pg_restore --no-owner --exit-on-error -d "$RESTORE_URL" united-YYYY-MM-DD.dump

# 3. Database compare, BEFORE anyone signs in to the copy.
#    Every table: row count + content hash; migration history identical.
npx tsx scripts/ops/restore-check.ts db-compare "$SOURCE_URL" "$RESTORE_URL"

# 4. Start a staging instance on the copy and confirm the schema is current.
DATABASE_URL="$RESTORE_URL" DIRECT_URL="$RESTORE_URL" npx prisma migrate status   # "up to date"
DATABASE_URL="$RESTORE_URL" DIRECT_URL="$RESTORE_URL" npx next start -p 3112

# 5. Business fingerprint of the copy; must be identical to step 1, and healths ok.
VERIFY_USER=<admin> VERIFY_PASSWORD=<…> npx tsx scripts/ops/restore-check.ts fingerprint http://localhost:3112 > fp-restored.json
diff fp-source.json fp-restored.json

# 6. Drop the copy.
```

When comparing against live production, the source keeps moving. Take the fingerprint
and the dump at the same quiet moment (for example after hours). Otherwise compare the
copy with a fingerprint of a second restore of the same dump.

### What the checks cover

| Requirement | Checked by |
|---|---|
| Login | `fingerprint` signs in through the app; the drill also signed in all 8 roles |
| Customers, suppliers, products | `fingerprint.masterData` counts; `db-compare` hashes every row |
| Inventory | `fingerprint.inventory`: products with stock, total on hand, total value |
| Stock ledger | `fingerprint.stockLedger`: latest movements; `db-compare` covers every movement |
| Lots | `fingerprint.lots`; `db-compare` on `StockLot` |
| Invoices | `fingerprint.invoices`: count and total of issued invoices |
| AR / AP | `fingerprint.ar` / `.ap`: aging totals by bucket |
| GL | `fingerprint.gl`: trial balance balanced, debit = credit, account count |
| Audit | `fingerprint.audit`: latest entries; `db-compare` on `AuditLog` |
| Accounts Health | `fingerprint.accountsHealth`: every check must pass |
| Inventory Health | `fingerprint.inventoryHealth`: on hand = valuation for every product, no negative balance |
| Database rules survive | Manual: an `UPDATE` on `JournalLine`, a `DELETE` on `StockMovement` and an unbalanced journal must all be refused by the copy |

## Drill result (2026-10-09)

| Step | Result |
|---|---|
| Backup | `pg_dump` custom format, 0.8 MB |
| Restore into a new database | Clean (`--exit-on-error`) |
| `db-compare` | **87 tables, 3,692 rows, 0 differing**; migrations 36 = 36 |
| `prisma migrate status` on the copy | Up to date |
| Fingerprint source vs copy | **Identical**: 14 customers, 18 suppliers, 47 products; 34 products in stock, 6,876.20 on hand, value 23,423.03; 18 issued invoices (9,910.55); AR 17,166.68; AP 7,425.00; trial balance 151,392.72 = 151,392.72 |
| Accounts Health on the copy | **ok** (no failing check) |
| Inventory Health on the copy | **ok** (0 mismatches, 0 negative balances) |
| Sign-in on the copy | 8 / 8 roles |
| Rules on the copy | Journal-line update refused; stock-movement delete refused; unbalanced journal refused at commit |
| Clean-up | Copy dropped, dump deleted |

The production drill (step 1 against production, restore into a Supabase branch or a
separate project) has **not** been performed from this environment and must be done once
before go-live (see the cutover checklist).
