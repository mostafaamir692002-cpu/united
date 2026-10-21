/* Security & accounting hardening — session TTL, IP lockout, backdated valuation audit. */
import { call, login, makeChecker } from "./_harness";

const { check, section, finish } = makeChecker();
const TAG = `zzhard${Date.now() % 1_000_000}`;

async function main() {
  await login("admin");
  await login("karim");

  // ---------------------------------------------------------------------------
  section("A. SESSION TTL IS CONFIGURABLE");
  {
    const set = await call("admin", "PATCH", "/api/admin/settings/auth.session_ttl_hours", { value: 1, reason: TAG });
    check("admin can set auth.session_ttl_hours", set.status === 201 || set.status === 200, set.status);
    const me = await call("admin", "GET", "/api/auth/me");
    check("admin session still works after TTL=1h", me.status === 200, me.status);
    const back = await call("admin", "PATCH", "/api/admin/settings/auth.session_ttl_hours", { value: 12, reason: TAG });
    check("admin restores default TTL", back.status === 201 || back.status === 200, back.status);
    const list = await call("admin", "GET", "/api/admin/settings");
    const ttlRow = (list.body.settings ?? []).find((s: any) => s.key === "auth.session_ttl_hours");
    check("TTL reads back as 12", Number(ttlRow?.value ?? ttlRow?.effective ?? 12) === 12, ttlRow);
  }

  // ---------------------------------------------------------------------------
  section("B. IP-WIDE LOGIN LOCKOUT");
  {
    const evilIp = "198.51.100.99"; // TEST-NET-2 — safe to spoof in tests
    const goodIp = "203.0.113.7";
    let got429 = false;
    let last = 0;
    for (let i = 0; i < 24 && !got429; i++) {
      last = (
        await call(null, "POST", "/api/auth/login", { username: `${TAG}u${i}`, password: "nope" }, { "x-forwarded-for": evilIp })
      ).status;
      if (last === 429) got429 = true;
    }
    check("many spoofed-IP failures from one address end in 429", got429, `last=${last}`);

    const single = await call(null, "POST", "/api/auth/login", { username: `${TAG}zz`, password: "nope" }, { "x-forwarded-for": goodIp });
    check("a single failure from a different address is NOT locked (401, not 429)", single.status === 401, single.status);

    const legit = await call(null, "POST", "/api/auth/login", { username: "admin", password: "1234" }, { "x-forwarded-for": goodIp });
    check("legit login from a clean address still works", legit.status === 200, legit.status);

    const locked = await call(null, "POST", "/api/auth/login", { username: "admin", password: "1234" }, { "x-forwarded-for": evilIp });
    check("locked address gets 429 even with the right password", locked.status === 429, locked.status);
  }

  // ---------------------------------------------------------------------------
  section("C. BACKDATED STOCK VALUATION IS AUDITED");
  {
    // Fixtures: a supplier and a stock-tracked product (seed creates users only).
    const sup = (await call("admin", "POST", "/api/stock/suppliers", { name: `${TAG} مورد` })).body.supplier;
    check("test supplier created", !!sup?.id);
    const prod = (await call("admin", "POST", "/api/stock/products", { name: `${TAG} طماطم`, unit: "KG" })).body.product;
    check("test product created", !!prod?.id);

    // Close an early, unused period so a receipt dated inside it is forced to re-date.
    const period = "2010-01";
    const close = await call("karim", "POST", `/api/accounting/periods/${period}/close`, {});
    check(`close ${period}`, close.status === 200, close.status);

    const intake = await call("admin", "POST", "/api/stock/intakes", {
      supplier_id: sup.id,
      product_id: prod.id,
      received_date: "2010-01-15",
      received_kg: 100,
      rejected_kg: 0,
      unit_cost: "10",
      idempotency_key: `${TAG}intake`,
    });
    check("receipt into a closed-period date still records (redated path)", intake.status === 201 || intake.status === 200, intake.status);

    const audit = await call("admin", "GET", "/api/audit?limit=100");
    const redated = (audit.body.logs ?? []).filter((l: any) => l.action === "stock_valuation_redated");
    check("an audit row records the redate", redated.length >= 1, redated.slice(0, 2));
  }

  finish("HARDENING");
}
main().catch((e) => { console.error("SUITE CRASHED", e); process.exit(2); });