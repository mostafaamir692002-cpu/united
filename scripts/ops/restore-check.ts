/**
 * Restore verification — read-only. Proves a restored database holds exactly what the
 * backup held, and that UNITED works on it.
 *
 *   tsx scripts/ops/restore-check.ts db-compare <sourceDbUrl> <restoredDbUrl>
 *     Every table: row count and a content hash, source vs restored. Must be identical.
 *
 *   VERIFY_USER=… VERIFY_PASSWORD=… tsx scripts/ops/restore-check.ts fingerprint <baseUrl>
 *     Signs in through the application and prints the business fingerprint: master data,
 *     inventory, stock ledger, lots, invoices, AR, AP, GL, audit, Accounts Health,
 *     Inventory Health. Run it against the original and the restored instance; the two
 *     outputs must be identical (and both healths ok).
 *
 * Neither mode writes business data (signing in records a session, as any sign-in does).
 * See docs/erp/BACKUP_RESTORE.md for the full drill.
 */
import { PrismaClient } from "@prisma/client";

async function dbCompare(a: string, b: string) {
  const open = (url: string) => new PrismaClient({ datasources: { db: { url } } });
  const [src, dst] = [open(a), open(b)];
  // Sign-in attempts legitimately change as people sign in to check the copy.
  const VOLATILE = new Set(["LoginAttempt", "_prisma_migrations"]);
  const tables = (await src.$queryRaw<{ t: string }[]>`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`).map((x) => x.t);
  const sig = async (db: PrismaClient, t: string) =>
    (await db.$queryRawUnsafe<{ n: bigint; h: string | null }[]>(`SELECT count(*) AS n, md5(string_agg(x::text, '|' ORDER BY x::text)) AS h FROM "public"."${t}" x`))[0];
  let differ = 0;
  let rows = 0;
  for (const t of tables) {
    if (VOLATILE.has(t)) continue;
    const [s, d] = [await sig(src, t), await sig(dst, t).catch(() => null)];
    rows += Number(s.n);
    if (!d || s.n !== d.n || s.h !== d.h) {
      differ++;
      console.log(`DIFFERS  ${t}: source ${s.n} rows, restored ${d ? d.n : "missing"} rows`);
    }
  }
  const migA = await src.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
  const migB = await dst.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
  console.log(JSON.stringify({ tables: tables.length - VOLATILE.size, rows, differing: differ, migrationsSource: Number(migA[0].n), migrationsRestored: Number(migB[0].n) }));
  await Promise.all([src.$disconnect(), dst.$disconnect()]);
  if (differ > 0 || migA[0].n !== migB[0].n) process.exit(1);
}

async function fingerprint(base: string) {
  const user = process.env.VERIFY_USER;
  const password = process.env.VERIFY_PASSWORD;
  if (!user || !password) throw new Error("set VERIFY_USER and VERIFY_PASSWORD (an administrator or finance account)");
  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user, password }) });
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  const get = async (path: string) => {
    const r = await fetch(base + path, { headers: { cookie } });
    if (r.status !== 200) throw new Error(`${path} → ${r.status}`);
    return r.json();
  };
  const sum = (xs: unknown[], f: (x: any) => unknown) => xs.reduce((s: number, x) => s + Number(f(x) ?? 0), 0).toFixed(2);

  const customers = (await get("/api/sales/customers?include_inactive=1")).customers;
  const suppliers = (await get("/api/purchasing/suppliers?include_inactive=1")).suppliers;
  const products = (await get("/api/stock/products?all=1")).products;
  const stock = (await get("/api/inventory/stock")).rows;
  const valuation = (await get("/api/inventory/reports/valuation")).rows;
  const invoices = (await get("/api/sales/invoices?status=issued")).invoices;
  const ar = (await get("/api/sales/reports/aging")).totals;
  const ap = (await get("/api/purchasing/reports/ap-aging")).aging.totals;
  const tb = (await get("/api/accounting/trial-balance?from=2000-01-01&to=2100-12-31")).trialBalance;
  const health = (await get("/api/accounting/integrity")).integrity;
  const audit = (await get("/api/audit")).logs;
  const ledger = (await get("/api/stock/ledger?limit=1000")).movements;

  // Inventory health: every product's on-hand equals its valuation quantity.
  const valBy = new Map(valuation.map((v: any) => [v.productId, Number(v.quantity)]));
  const inventoryMismatches = stock.filter((s: any) => Math.abs(Number(s.onHand) - Number(valBy.get(s.productId) ?? 0)) > 0.0005).map((s: any) => s.productName ?? s.productId);
  const negative = stock.filter((s: any) => Number(s.onHand) < 0).length;

  const out = {
    login: "ok",
    masterData: { customers: customers.length, suppliers: suppliers.length, products: products.length },
    inventory: { productsWithStock: stock.filter((s: any) => Number(s.onHand) !== 0).length, onHandTotal: sum(stock, (s) => s.onHand), valueTotal: sum(valuation, (v) => v.value) },
    stockLedger: { latestMovements: ledger.length, latestMovementId: ledger[0]?.id ?? null },
    lots: { distinctLotsInLatestMovements: new Set(ledger.map((m: any) => m.lotId).filter(Boolean)).size },
    invoices: { issued: invoices.length, total: sum(invoices, (i) => i.total) },
    ar: { total: ar.total, current: ar.current, d90_plus: ar.d90_plus },
    ap: { total: ap.total, current: ap.current, d90_plus: ap.d90_plus },
    gl: { balanced: tb.balanced, debit: tb.totals.debit, credit: tb.totals.credit, accounts: tb.lines.length },
    audit: { latest: audit.length, latestId: audit[0]?.id ?? null },
    accountsHealth: { ok: health.ok, failing: health.checks.filter((c: any) => !c.ok).map((c: any) => c.key) },
    inventoryHealth: { ok: inventoryMismatches.length === 0 && negative === 0, mismatches: inventoryMismatches.length, negativeBalances: negative },
  };
  console.log(JSON.stringify(out, null, 1));
  if (!out.accountsHealth.ok || !out.inventoryHealth.ok || !out.gl.balanced) process.exit(1);
}

const [mode, a, b] = process.argv.slice(2);
(mode === "db-compare" && a && b ? dbCompare(a, b) : mode === "fingerprint" && a ? fingerprint(a) : Promise.reject(new Error("usage: db-compare <sourceUrl> <restoredUrl> | fingerprint <baseUrl>"))).catch((e) => {
  console.error("RESTORE CHECK FAILED:", e.message);
  process.exit(2);
});
