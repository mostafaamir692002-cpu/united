import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";
import { isValidISODate } from "@/lib/dates";
import { todayLocalISO } from "@/lib/localDate";
import { valuationReport } from "@/lib/inventory/reports";
import { agingReport } from "@/lib/sales/invoicing";
import { apAgingReport } from "@/lib/purchasing/bills";
import { cashPosition } from "@/lib/accounting/cash";

/**
 * Management reporting — read-only queries over the sources of truth (invoices, the
 * stock ledger and its valuation layers, the journal, orders, trips, exceptions,
 * audit). Nothing here is stored; every figure can be traced to the documents.
 *
 * Gross margin uses the cost of what was actually issued (valuation layers of issues
 * and customer returns), not an estimate, and revenue from issued invoices net of
 * credit notes — so it is right even before the period's stock valuation is posted.
 */

const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0);
const f2 = (d: Prisma.Decimal) => d.toFixed(2);

function range(from?: string, to?: string) {
  const t = to ?? todayLocalISO();
  const f = from ?? `${t.slice(0, 7)}-01`;
  if (!isValidISODate(f) || !isValidISODate(t) || f > t) throw new ApiError(400, "الفترة غير صالحة");
  return { from: f, to: t };
}

// ---------------------------------------------------------------------------
// Finance (reports.finance)
// ---------------------------------------------------------------------------

export async function financeReport(opts: { from?: string; to?: string }) {
  const { from, to } = range(opts.from, opts.to);

  // Revenue by product: invoice lines − credit note lines, net of discount, before tax.
  const revenue = await prisma.$queryRaw<{ productId: string | null; description: string; net: Prisma.Decimal; qty: Prisma.Decimal }[]>`
    SELECT l."productId", min(l."description") AS description, sum(l."net") AS net, sum(l."quantity") AS qty
    FROM "SalesInvoiceLine" l JOIN "SalesInvoice" i ON i."id" = l."invoiceId"
    WHERE i."status" = 'issued' AND i."issueDate" BETWEEN ${from} AND ${to}
    GROUP BY l."productId"`;
  const credits = await prisma.$queryRaw<{ productId: string | null; net: Prisma.Decimal }[]>`
    SELECT il."productId", sum(cl."net") AS net
    FROM "CreditNoteLine" cl JOIN "CreditNote" c ON c."id" = cl."creditNoteId" JOIN "SalesInvoiceLine" il ON il."id" = cl."invoiceLineId"
    WHERE c."issueDate" BETWEEN ${from} AND ${to}
    GROUP BY il."productId"`;
  // Cost of what left (issues) less what came back (customer returns), by product.
  const cogs = await prisma.$queryRaw<{ productId: string; cost: Prisma.Decimal }[]>`
    SELECT v."productId", -sum(v."value") AS cost
    FROM "StockValuationLayer" v JOIN "StockMovement" m ON m."id" = v."movementId"
    WHERE m."kind" IN ('issue', 'customer_return') AND m."effectiveDate" BETWEEN ${from} AND ${to}
    GROUP BY v."productId"`;
  const products = new Map((await prisma.stockProduct.findMany({ select: { id: true, name: true, nameAr: true } })).map((p) => [p.id, p.nameAr ?? p.name]));
  const byProduct = new Map<string, { name: string; revenue: Prisma.Decimal; cost: Prisma.Decimal; qty: Prisma.Decimal }>();
  const row = (id: string | null, name: string) => {
    const k = id ?? `—${name}`;
    const r = byProduct.get(k) ?? { name: id ? products.get(id) ?? name : name, revenue: D(0), cost: D(0), qty: D(0) };
    byProduct.set(k, r);
    return r;
  };
  for (const r of revenue) { const x = row(r.productId, r.description); x.revenue = x.revenue.plus(r.net); x.qty = x.qty.plus(r.qty); }
  for (const c of credits) { const x = row(c.productId, "—"); x.revenue = x.revenue.minus(c.net); }
  for (const c of cogs) { const x = row(c.productId, products.get(c.productId) ?? "—"); x.cost = x.cost.plus(c.cost); }
  const lines = [...byProduct.values()].map((r) => ({ product: r.name, quantity: r.qty.toString(), revenue: f2(r.revenue), cost: f2(r.cost), margin: f2(r.revenue.minus(r.cost)), marginPct: r.revenue.gt(0) ? r.revenue.minus(r.cost).dividedBy(r.revenue).times(100).toFixed(1) : null })).sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const totalRevenue = [...byProduct.values()].reduce((s, r) => s.plus(r.revenue), D(0));
  const totalCost = [...byProduct.values()].reduce((s, r) => s.plus(r.cost), D(0));

  // Sales by customer.
  const byCustomer = await prisma.$queryRaw<{ customerId: string; name: string; net: Prisma.Decimal; invoices: bigint }[]>`
    SELECT i."customerId", coalesce(c."nameAr", c."name") AS name, sum(i."net") AS net, count(*) AS invoices
    FROM "SalesInvoice" i JOIN "Customer" c ON c."id" = i."customerId"
    WHERE i."status" = 'issued' AND i."issueDate" BETWEEN ${from} AND ${to}
    GROUP BY i."customerId", c."nameAr", c."name" ORDER BY sum(i."net") DESC LIMIT 15`;

  // Profit and loss from the journal (what has been posted).
  const pl = await prisma.$queryRaw<{ type: string; systemKey: string | null; code: string; name: string; amount: Prisma.Decimal }[]>`
    SELECT a."type", a."systemKey", a."code", a."nameAr" AS name, sum(l."credit" - l."debit") AS amount
    FROM "JournalLine" l JOIN "JournalEntry" e ON e."id" = l."entryId" JOIN "Account" a ON a."id" = l."accountId"
    WHERE a."type" IN ('revenue', 'expense') AND e."date" BETWEEN ${from} AND ${to}
    GROUP BY a."type", a."systemKey", a."code", a."nameAr" ORDER BY a."code"`;
  const plRevenue = pl.filter((x) => x.type === "revenue").reduce((s, x) => s.plus(x.amount), D(0));
  const plExpense = pl.filter((x) => x.type === "expense").reduce((s, x) => s.minus(x.amount), D(0));

  const [valuation, ar, ap, cash, movement] = await Promise.all([
    valuationReport(),
    agingReport(to),
    apAgingReport(to),
    cashPosition(),
    prisma.$queryRaw<{ kind: string; qty: Prisma.Decimal; value: Prisma.Decimal }[]>`
      SELECT m."kind", sum(m."quantity") AS qty, coalesce(sum(v."value"), 0) AS value
      FROM "StockMovement" m LEFT JOIN "StockValuationLayer" v ON v."movementId" = m."id"
      WHERE m."effectiveDate" BETWEEN ${from} AND ${to}
      GROUP BY m."kind" ORDER BY m."kind"`,
  ]);

  return {
    from, to,
    sales: { revenue: f2(totalRevenue), cost: f2(totalCost), grossMargin: f2(totalRevenue.minus(totalCost)), grossMarginPct: totalRevenue.gt(0) ? totalRevenue.minus(totalCost).dividedBy(totalRevenue).times(100).toFixed(1) : null, byProduct: lines.slice(0, 30), byCustomer: byCustomer.map((c) => ({ customerId: c.customerId, name: c.name, net: f2(D(c.net)), invoices: Number(c.invoices) })) },
    profitAndLoss: { lines: pl.map((x) => ({ code: x.code, name: x.name, type: x.type, amount: f2(D(x.amount)) })), revenue: f2(plRevenue), expenses: f2(plExpense), net: f2(plRevenue.minus(plExpense)) },
    receivables: { totals: ar.totals, top: ar.rows.slice(0, 10) },
    payables: { totals: ap.totals, top: ap.rows.slice(0, 10) },
    inventory: { value: valuation.totalValue.toFixed(2), top: valuation.rows.slice(0, 15).map((r) => ({ product: r.productNameAr ?? r.productName, unit: r.unit, quantity: r.quantity.toString(), value: r.value.toFixed(2) })) },
    stockMovement: movement.map((m) => ({ kind: m.kind, quantity: D(m.qty).toString(), value: f2(D(m.value)) })),
    cash,
  };
}

// ---------------------------------------------------------------------------
// Operations (reports.view) — quantities, times and counts; no money.
// ---------------------------------------------------------------------------

export async function operationsReport(opts: { from?: string; to?: string }) {
  const { from, to } = range(opts.from, opts.to);

  // Fulfilment: required → prepared → loaded → delivered, over orders due in the range.
  const [fill] = await prisma.$queryRaw<{ orders: bigint; required: number; prepared: number; loaded: number; dispatched: bigint; cancelled: bigint }[]>`
    SELECT count(DISTINCT o."id") AS orders, coalesce(sum(i."requiredQuantity"), 0) AS required, coalesce(sum(i."preparedQuantity"), 0) AS prepared, coalesce(sum(i."loadedQuantity"), 0) AS loaded,
      count(DISTINCT o."id") FILTER (WHERE o."status" = 'dispatched') AS dispatched, count(DISTINCT o."id") FILTER (WHERE o."status" = 'cancelled') AS cancelled
    FROM "Order" o JOIN "OrderItem" i ON i."orderId" = o."id"
    WHERE o."deliveryDate" BETWEEN ${from} AND ${to}`;
  const [delivered] = await prisma.$queryRaw<{ shipped: Prisma.Decimal; delivered: Prisma.Decimal; shortage: Prisma.Decimal; damaged: Prisma.Decimal; rejected: Prisma.Decimal }[]>`
    SELECT coalesce(sum(d."shippedQty"), 0) AS shipped, coalesce(sum(d."deliveredQty"), 0) AS delivered, coalesce(sum(d."shortageQty"), 0) AS shortage, coalesce(sum(d."damagedQty"), 0) AS damaged, coalesce(sum(d."rejectedQty"), 0) AS rejected
    FROM "DeliveryLine" d JOIN "TripStop" s ON s."id" = d."stopId" JOIN "Trip" t ON t."id" = s."tripId"
    WHERE t."tripDate" BETWEEN ${from} AND ${to}`;
  const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) : null);

  // Preparation: per preparer, orders and the time from "preparing" to "ready".
  const prep = await prisma.$queryRaw<{ preparer: string | null; orders: bigint; avgMinutes: number | null }[]>`
    WITH s AS (
      SELECT a."orderId", min(a."timestamp") FILTER (WHERE a."newValue" = 'preparing') AS started, min(a."timestamp") FILTER (WHERE a."newValue" = 'ready_for_loading') AS ready
      FROM "AuditLog" a WHERE a."fieldChanged" = 'status' AND a."orderId" IS NOT NULL GROUP BY a."orderId"
    )
    SELECT o."assignedToName" AS preparer, count(*) AS orders, avg(extract(epoch FROM (s.ready - s.started)) / 60) AS "avgMinutes"
    FROM s JOIN "Order" o ON o."id" = s."orderId"
    WHERE s.started IS NOT NULL AND s.ready IS NOT NULL AND o."deliveryDate" BETWEEN ${from} AND ${to}
    GROUP BY o."assignedToName" ORDER BY count(*) DESC`;

  // Loading and delivery, from trips.
  const [trips] = await prisma.$queryRaw<{ trips: bigint; completed: bigint; avgLoadMinutes: number | null; avgDispatchToDoneMinutes: number | null }[]>`
    SELECT count(*) AS trips, count(*) FILTER (WHERE "status" = 'completed') AS completed,
      avg(extract(epoch FROM ("loadedAt" - "loadingStartedAt")) / 60) AS "avgLoadMinutes",
      avg(extract(epoch FROM ("completedAt" - "dispatchedAt")) / 60) AS "avgDispatchToDoneMinutes"
    FROM "Trip" WHERE "tripDate" BETWEEN ${from} AND ${to} AND "status" <> 'cancelled'`;
  const stops = await prisma.$queryRaw<{ driver: string; delivered: bigint; partial: bigint; failed: bigint; pending: bigint }[]>`
    SELECT d."name" AS driver, count(*) FILTER (WHERE s."status" = 'delivered') AS delivered, count(*) FILTER (WHERE s."status" = 'partial') AS partial,
      count(*) FILTER (WHERE s."status" = 'failed') AS failed, count(*) FILTER (WHERE s."status" = 'pending') AS pending
    FROM "TripStop" s JOIN "Trip" t ON t."id" = s."tripId" JOIN "Driver" d ON d."id" = t."driverId"
    WHERE s."active" AND t."tripDate" BETWEEN ${from} AND ${to}
    GROUP BY d."name" ORDER BY d."name"`;

  // Exceptions raised in the range.
  const exceptions = await prisma.$queryRaw<{ type: string; open: bigint; resolved: bigint; avgHoursToResolve: number | null }[]>`
    SELECT "type", count(*) FILTER (WHERE "status" = 'open') AS open, count(*) FILTER (WHERE "status" = 'resolved') AS resolved,
      avg(extract(epoch FROM ("resolvedAt" - "createdAt")) / 3600) AS "avgHoursToResolve"
    FROM "OperationalException" WHERE "createdAt"::date BETWEEN ${from}::date AND ${to}::date GROUP BY "type" ORDER BY "type"`;

  // Inventory aging: what is on hand now, by how long ago its lot was received.
  const aging = await prisma.$queryRaw<{ bucket: string; qty: Prisma.Decimal; lots: bigint }[]>`
    WITH b AS (
      SELECT m."lotId", sum(m."quantity") AS qty FROM "StockMovement" m WHERE m."lotId" IS NOT NULL GROUP BY m."lotId" HAVING sum(m."quantity") > 0
    )
    SELECT CASE WHEN ${to}::date - l."receivedDate"::date <= 2 THEN '0-2' WHEN ${to}::date - l."receivedDate"::date <= 7 THEN '3-7'
                WHEN ${to}::date - l."receivedDate"::date <= 14 THEN '8-14' ELSE '15+' END AS bucket,
      sum(b.qty) AS qty, count(*) AS lots
    FROM b JOIN "StockLot" l ON l."id" = b."lotId" GROUP BY 1 ORDER BY 1`;

  const num = (x: number | null) => (x == null ? null : Math.round(Number(x)));
  return {
    from, to,
    fulfilment: {
      orders: Number(fill?.orders ?? 0), dispatched: Number(fill?.dispatched ?? 0), cancelled: Number(fill?.cancelled ?? 0),
      required: Number(fill?.required ?? 0), prepared: Number(fill?.prepared ?? 0), loaded: Number(fill?.loaded ?? 0),
      preparedPct: pct(Number(fill?.prepared ?? 0), Number(fill?.required ?? 0)), loadedPct: pct(Number(fill?.loaded ?? 0), Number(fill?.required ?? 0)),
      delivery: { shipped: D(delivered?.shipped).toString(), delivered: D(delivered?.delivered).toString(), shortage: D(delivered?.shortage).toString(), damaged: D(delivered?.damaged).toString(), rejected: D(delivered?.rejected).toString(), deliveredPct: pct(Number(delivered?.delivered ?? 0), Number(delivered?.shipped ?? 0)) },
    },
    preparation: prep.map((p) => ({ preparer: p.preparer ?? "غير موزّع", orders: Number(p.orders), avgMinutes: num(p.avgMinutes) })),
    loading: { trips: Number(trips?.trips ?? 0), completed: Number(trips?.completed ?? 0), avgLoadMinutes: num(trips?.avgLoadMinutes ?? null), avgDispatchToDoneMinutes: num(trips?.avgDispatchToDoneMinutes ?? null) },
    delivery: stops.map((s) => ({ driver: s.driver, delivered: Number(s.delivered), partial: Number(s.partial), failed: Number(s.failed), pending: Number(s.pending) })),
    exceptions: exceptions.map((e) => ({ type: e.type, open: Number(e.open), resolved: Number(e.resolved), avgHoursToResolve: e.avgHoursToResolve == null ? null : Number(Number(e.avgHoursToResolve).toFixed(1)) })),
    inventoryAging: aging.map((a) => ({ bucket: a.bucket, quantity: D(a.qty).toString(), lots: Number(a.lots) })),
  };
}
