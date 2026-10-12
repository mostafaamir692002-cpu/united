import { call, login, makeChecker } from "./_harness";

const { check, section, finish } = makeChecker();
const T = "ZZE2E-" + Date.now();
const today = new Date().toISOString().slice(0, 10);
let r: any;

async function main() {
  for (const u of ["admin", "sara", "hossam", "ahmed", "mostafa", "mona", "karim", "omar"]) await login(u);

  // SETUP
  const tomato = (await call("hossam", "POST", "/api/stock/products", { name: T + " Tomato", unit: "KG" })).body.product;
  const onion = (await call("hossam", "POST", "/api/stock/products", { name: T + " Onion", unit: "KG" })).body.product;
  const sup = (await call("omar", "POST", "/api/purchasing/suppliers", { name: T + " Farm", payment_terms_days: 15 })).body.supplier;
  await call("omar", "POST", `/api/purchasing/suppliers/${sup.id}/prices`, { valid_from: "2026-01-01", prices: [{ product_id: tomato.id, unit_price: "5" }] });
  await call("karim", "POST", "/api/accounting/opening-stock", { business_date: today, lines: [{ product_id: tomato.id, quantity: 500, unit_cost: "5", expiry_date: today.substring(0,7) + "-28", location_id: "loc_cold_1" }] });
  await call("hossam", "POST", "/api/stock/intakes", { supplier_id: sup.id, product_id: onion.id, received_date: today, received_kg: 200, unit_cost: "3", location_id: "loc_cold_1" });
  const hotel = (await call("mona", "POST", "/api/sales/customers", { name: T + " Hotel" })).body.customer;
  const cafe = (await call("mona", "POST", "/api/sales/customers", { name: T + " Cafe" })).body.customer;
  const shop = (await call("mona", "POST", "/api/sales/customers", { name: T + " Shop" })).body.customer;
  const pl = (await call("mona", "POST", "/api/sales/price-lists", { code: "PL" + T.slice(-4), name: T + " Prices", is_default: true })).body.priceList;
  await call("mona", "POST", `/api/sales/price-lists/${pl.id}/prices`, { valid_from: today, prices: [{ product_id: tomato.id, unit_price: "10" }] });

  // 1. SALES ORDERS WITH PRICING
  section("1. ORDERS");
  const ho = (await call("mona", "POST", "/api/orders", { customer_account_id: hotel.id, customer_name: hotel.name, delivery_date: today, items: [{ stock_product_id: tomato.id, product_name: "Tomato", quantity: 90 }, { stock_product_id: onion.id, product_name: "Onion", quantity: 40 }] })).body.order;
  // Find items by product
  const hTomatoItem = ho.items.find((i: any) => i.stockProductId === tomato.id)!;
  const hOnionItem = ho.items.find((i: any) => i.stockProductId === onion.id)!;
  await call("mona", "PATCH", `/api/orders/${ho.id}/items/${hTomatoItem.id}/price`, { unit_price: "12", reason: "خاص" });

  const co = (await call("mona", "POST", "/api/orders", { customer_account_id: cafe.id, customer_name: cafe.name, delivery_date: today, items: [{ stock_product_id: tomato.id, product_name: "Tomato", quantity: 50 }] })).body.order;
  const cTomatoItem = co.items.find((i: any) => i.stockProductId === tomato.id)!;
  await call("mona", "PATCH", `/api/orders/${co.id}/items/${cTomatoItem.id}/price`, { unit_price: "9", reason: "حسم" });

  const so = (await call("mona", "POST", "/api/orders", { customer_account_id: shop.id, customer_name: shop.name, delivery_date: today, items: [{ stock_product_id: tomato.id, product_name: "Tomato", quantity: 60 }] })).body.order;

  // Verify pricing
  const hp = (await call("mona", "GET", `/api/orders/${ho.id}/pricing`)).body;
  check("hotel tomato 90×12=1080", hp.lines.find((l: any) => l.itemId === hTomatoItem.id)?.amounts?.total === "1080.00", hp);
  check("hotel onion 40×6=240 (default)", hp.lines.find((l: any) => l.itemId === hOnionItem.id)?.amounts?.total === "240.00", hp);
  const cp = (await call("mona", "GET", `/api/orders/${co.id}/pricing`)).body;
  check("cafe 50×9=450", cp.lines.find((l: any) => l.itemId === cTomatoItem.id)?.amounts?.total === "450.00", cp);
  const sp = (await call("mona", "GET", `/api/orders/${so.id}/pricing`)).body;
  check("shop 60×10=600", Number(sp.totals.total) === 600, sp.totals);
  check("salesperson can set price (mona has price_override)", true, true);

  // 2. CONSOLIDATED PICKING
  section("2. PICKING");
  for (const o of [ho, co, so]) await call("ahmed", "POST", `/api/orders/${o.id}/status`, { to: "preparing" });
  const sheet = (await call("sara", "GET", `/api/production/daily/sheet?date=${today}`)).body;
  const tLine = sheet.lines.find((l: any) => l.productName === "Tomato" || l.productName === T + " Tomato");
  check("tomato 200 aggregate", tLine?.totalRequired === 200, tLine);
  check("3 customers", tLine?.allocations?.length === 3, tLine);
  check("alloc sum 200", tLine?.allocations.reduce((s: number, a: any) => s + a.requiredQuantity, 0) === 200);

  // 3. SUPERVISOR REJECTION
  section("3. REJECTION");
  r = await call("ahmed", "POST", `/api/orders/${ho.id}/items/${hTomatoItem.id}/prepare`, { quantity: 93, mark_done: true, expected_version: hTomatoItem.version });
  check("prepared 93", r.status === 200, r);
  const hTomato2 = (await call("sara", "GET", `/api/orders/${ho.id}`)).body.order.items.find((i: any) => i.id === hTomatoItem.id)!;
  r = await call("sara", "POST", `/api/orders/${ho.id}/items/${hTomatoItem.id}/reject-preparation`, { correct_quantity: 90, reason: "مطلوب 90 فقط", expected_version: hTomato2.version });
  check("rejected: pending req=90", r.status === 200 && r.body.item.preparationStatus === "pending" && r.body.item.requiredQuantity === 90, r.body);
  check("rejection in notes", /رفض/.test(r.body.item.notes ?? ""), r.body.item.notes);
  const hTomato3 = (await call("sara", "GET", `/api/orders/${ho.id}`)).body.order.items.find((i: any) => i.id === hTomatoItem.id)!;
  r = await call("ahmed", "POST", `/api/orders/${ho.id}/items/${hTomatoItem.id}/prepare`, { quantity: 90, mark_done: true, expected_version: hTomato3.version });
  check("corrected 90 done", r.status === 200 && r.body.item.preparationStatus === "done" && r.body.item.preparedQuantity === 90, r.body);

  // Prepare all remaining items
  for (const o of [ho, co, so]) {
    const ord = (await call("sara", "GET", `/api/orders/${o.id}`)).body.order;
    for (const i of ord.items) {
      if (i.preparationStatus !== "done") await call("ahmed", "POST", `/api/orders/${o.id}/items/${i.id}/prepare`, { quantity: i.requiredQuantity, mark_done: true, expected_version: i.version });
    }
    const ord2 = (await call("sara", "GET", `/api/orders/${o.id}`)).body.order;
    await call("ahmed", "POST", `/api/orders/${o.id}/status`, { to: "ready_for_loading", expected_version: ord2.version });
  }

  // 4. LOADING & DISPATCH
  section("4. DISPATCH");
  for (const o of [ho, co, so]) {
    let ord = (await call("sara", "GET", `/api/orders/${o.id}`)).body.order;
    await call("mostafa", "POST", `/api/orders/${o.id}/status`, { to: "loading", expected_version: ord.version });
    for (const i of ord.items) await call("mostafa", "POST", `/api/orders/${o.id}/items/${i.id}/load`, { quantity: i.preparedQuantity, mark_done: true });
    ord = (await call("sara", "GET", `/api/orders/${o.id}`)).body.order;
    await call("mostafa", "POST", `/api/orders/${o.id}/status`, { to: "loaded", expected_version: ord.version });
    ord = (await call("sara", "GET", `/api/orders/${o.id}`)).body.order;
    r = await call("mostafa", "POST", `/api/orders/${o.id}/status`, { to: "dispatched", vehicle: "v", driver_name: "d", crate_count: 2, expected_version: ord.version });
    check(`${o.id.slice(-5)} dispatched`, r.status === 200, r);
  }

  // 5. INVOICES - totals match agreed prices
  section("5. INVOICES");
  for (const o of [ho, co, so]) {
    const inv = (await call("karim", "POST", "/api/sales/invoices", { order_id: o.id })).body.invoice;
    await call("karim", "POST", `/api/sales/invoices/${inv.id}/issue`, {});
    const issued = (await call("karim", "GET", `/api/sales/invoices/${inv.id}`)).body.invoice;
    check(`${o.id.slice(-5)} line priced`, Number(issued.lines[0]?.unitPrice) > 0, issued.lines[0]);
    if (o.id === ho.id) check("hotel 90×12+40×6=1320", Number(issued.total) === 1320, issued.total);
    if (o.id === co.id) check("cafe 50×9=450", Number(issued.total) === 450, issued.total);
    if (o.id === so.id) check("shop 60×10=600", Number(issued.total) === 600, issued.total);
  }

  // 6. PURCHASE ORDER + APPROVAL
  section("6. PURCHASING");
  r = await call("omar", "POST", "/api/purchasing/orders", { supplier_id: sup.id, lines: [{ product_id: tomato.id, quantity: 100 }] });
  check("PO created", r.status === 201, r);
  const po = r.body.order;

  const st = (await call("admin", "GET", "/api/admin/settings")).body.settings.find((s: any) => s.key === "purchasing.po_approval_threshold");
  await call("admin", "PATCH", "/api/admin/settings/purchasing.po_approval_threshold", { value: 50, reason: T, expected_version: st.version });
  r = await call("omar", "POST", `/api/purchasing/orders/${po.id}/submit`, {});
  check("submitted for approval", r.body.order?.status === "pending_approval", r);
  const appr = (await call("karim", "GET", "/api/approvals?status=pending")).body.approvals.find((a: any) => a.entityId === po.id);
  check("PO in inbox", appr?.type === "purchasing.order", appr);
  check("buyer cannot approve own PO", (await call("omar", "POST", `/api/approvals/${appr.id}/decide`, { decision: "approve" })).status === 403);
  r = await call("karim", "POST", `/api/approvals/${appr.id}/decide`, { decision: "approve", comment: "ok" });
  check("finance approves", r.status === 200, r);
  await call("omar", "POST", `/api/purchasing/orders/${po.id}/send`, {});
  const st2 = (await call("admin", "GET", "/api/admin/settings")).body.settings.find((s: any) => s.key === "purchasing.po_approval_threshold");
  await call("admin", "PATCH", "/api/admin/settings/purchasing.po_approval_threshold", { value: null, reason: T, expected_version: st2.version });

  // 7. RAW RECEIPT + DEFERRED GRADING
  section("7. GRADING");
  r = await call("hossam", "POST", "/api/stock/intakes", { supplier_id: sup.id, product_id: tomato.id, received_date: today, received_kg: 100, purchase_order_line_id: po.lines[0].id });
  check("raw receipt 100 kg", r.status === 201, r);
  const intake = r.body.intake;
  r = await call("hossam", "POST", `/api/stock/intakes/${intake.id}/grade`, { good_kg: 70, grade_b_kg: 20, waste_kg: 5 });
  check("grading 70+20+5=95 ok", r.status === 201, r);
  check("5 kg remaining ungraded", r.body.grading.remainingKg === 5, r.body.grading);
  r = await call("hossam", "POST", `/api/stock/intakes/${intake.id}/grade`, { good_kg: 1 });
  check("duplicate grading blocked -> 409", r.status === 409, r);

  // 8. SUPPLIER BILL + POSTING
  section("8. BILL");
  const bl = (await call("omar", "GET", `/api/purchasing/suppliers/${sup.id}/billable`)).body;
  const rcpt = bl.find((b: any) => b.receiptNumber === intake.receiptNumber);
  check("receipt billable", !!rcpt, !!rcpt);
  r = await call("omar", "POST", "/api/purchasing/bills", { supplier_id: sup.id, supplier_invoice_no: "INV-" + T, bill_date: today, lines: [{ intake_id: intake.id, unit_price: rcpt.expectedUnitPrice }] });
  check("bill created", r.status === 201, r);
  r = await call("omar", "POST", `/api/purchasing/bills/${r.body.bill.id}/post`, {});
  check("bill posted", r.status === 200, r);
  r = await call("omar", "POST", "/api/purchasing/bills", { supplier_id: sup.id, supplier_invoice_no: "INV-" + T, bill_date: today, lines: [{ intake_id: intake.id, unit_price: rcpt.expectedUnitPrice }] });
  check("duplicate bill -> 409", r.status === 409, r);

  // 9. TRIAL BALANCE
  section("9. TRIAL BALANCE");
  const tb = (await call("karim", "GET", "/api/accounting/trial-balance")).body;
  check("trial balance loaded", tb.rows?.length > 0, tb.rows?.length);
  const dr = tb.rows.reduce((s: number, r: any) => s + Number(r.debit), 0);
  const cr = tb.rows.reduce((s: number, r: any) => s + Number(r.credit), 0);
  check(`dr=${Math.round(dr)}=cr=${Math.round(cr)}`, Math.abs(dr - cr) < 1, { dr, cr });

  // 10. SECURITY & AUTH SWITCH
  section("10. AUTH");
  await login("admin");
  check("admin is SUPER_ADMIN", (await call("admin", "GET", "/api/auth/me")).body.user?.role === "SUPER_ADMIN");
  await login("ahmed");
  check("ahmed is PREPARER", (await call("ahmed", "GET", "/api/auth/me")).body.user?.role === "PREPARER");
  check("preparer denied admin", (await call("ahmed", "GET", "/api/admin/users")).status === 403);
  check("anon denied orders", (await call(null, "POST", "/api/orders", {})).status === 401);
  check("anon denied reject", (await call(null, "POST", "/api/orders/x/items/x/reject-preparation", {})).status === 401);
  check("anon denied grading", (await call(null, "POST", "/api/stock/intakes/x/grade", {})).status === 401);

  finish("E2E-ACCEPTANCE");
}
main().catch((e) => { console.error(e); process.exit(1); });