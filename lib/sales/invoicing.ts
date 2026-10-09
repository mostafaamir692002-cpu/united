import { Prisma, type SalesInvoice } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";
import { assertEgpCurrency } from "@/lib/core/currency";
import { writeAudit } from "@/lib/audit";
import { assertPermission } from "@/lib/authz-core";
import { advisoryXactLock } from "@/lib/dbLock";
import { inTx, type Tx } from "@/lib/tx";
import { todayLocalISO } from "@/lib/localDate";
import { isValidISODate } from "@/lib/dates";
import { nextDocumentNumber } from "@/lib/core/sequences";
import { optText, parse, text, version } from "@/lib/core/validation";
import type { ServiceActor } from "@/lib/core/actor";
import { lineAmounts, sumAmounts, type LineAmounts } from "@/lib/sales/money";
import { postCreditNote, postSalesInvoice } from "@/lib/accounting/ledger";
import { postCustomerReturnInTx } from "@/lib/inventory/documents";
import { idempotencyKeyField, lockKey, replayRequest, requestFingerprint } from "@/lib/core/idempotency";

/**
 * Sales invoicing.
 *
 *  1. A dispatched order is invoiced on what LEFT (loaded quantity, else prepared,
 *     else required) at the prices on its lines. Every line with a quantity must be
 *     priced, and the customer must be a known account — an invoice to "whoever" is
 *     not a tax document.
 *  2. A draft can be reviewed and voided; issuing allocates the number (gapless),
 *     dates it, freezes the buyer's identity and the amounts. From then on the
 *     database refuses any change to it.
 *  3. Anything wrong after issue is a credit note against it: by quantity per line
 *     (returned, refused, short), never more than was invoiced on that line.
 *
 * The customer's receivable = issued invoices − credit notes (− payments, Phase 6).
 */

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
type Actorish = ServiceActor;

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const auditInv = (tx: Tx, actor: Actorish, entityType: "sales_invoice" | "credit_note", id: string, action: string, detail: string | null, orderId?: string | null, reason?: string | null) =>
  writeAudit(
    { userId: actor.id, userName: actor.name, role: actor.role, action, entityType, entityId: id, orderId: orderId ?? null, newValue: detail, reason: reason ?? undefined, source: "user", deviceId: actor.deviceId },
    tx
  );
const amountsData = (a: LineAmounts) => ({ gross: a.gross, discount: a.discount, net: a.net, tax: a.tax, total: a.total });
const totalsData = (a: LineAmounts) => ({ gross: a.gross, discountTotal: a.discount, net: a.net, taxTotal: a.tax, total: a.total });

// ---------------------------------------------------------------------------
// Draft from a dispatched order
// ---------------------------------------------------------------------------

export async function createInvoiceFromOrder(orderId: string, actor: ServiceActor) {
  assertPermission(actor, "sales.invoices.manage");
  return inTx(async (tx) => {
    await advisoryXactLock(tx, `sales:invoice-order:${orderId}`);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { price: true }, orderBy: { id: "asc" } } } });
    if (!order) throw new ApiError(404, "الأوردر مش موجود");
    if (order.status !== "dispatched") throw new ApiError(409, "الفاتورة بتتعمل للأوردر بعد ما يخرج");
    if (!order.customerAccountId) throw new ApiError(409, "اربط الأوردر بحساب عميل الأول — الفاتورة لازم تكون لعميل معروف");
    const existing = await tx.salesInvoice.findFirst({ where: { orderId, status: { not: "void" } } });
    if (existing) return { invoice: existing, created: false };
    // On a trip, the customer pays for what was delivered — so the delivery result
    // must be in first. (Orders dispatched without a trip keep the loaded quantity.)
    const stop = await tx.tripStop.findFirst({ where: { orderId, active: true }, include: { lines: true } });
    if (stop?.status === "pending") throw new ApiError(409, "نتيجة التسليم لسه مااتسجلتش — الفاتورة بتتعمل على اللي اتسلم");
    const delivered = stop ? new Map(stop.lines.map((l) => [l.orderItemId, l.deliveredQty])) : null;
    const lines: Prisma.SalesInvoiceLineCreateManyInvoiceInput[] = [];
    const amounts: LineAmounts[] = [];
    let n = 0;
    for (const i of order.items) {
      const qty = delivered ? D(delivered.get(i.id) ?? 0) : D(i.loadedQuantity ?? i.preparedQuantity ?? i.requiredQuantity).toDecimalPlaces(3);
      if (!qty.gt(0)) continue;
      if (!i.price) throw new ApiError(409, `سطر "${i.productName}" من غير سعر — سعّره الأول`);
      const a = lineAmounts({ quantity: qty, unitPrice: i.price.unitPrice, discountPct: i.price.discountPct, taxRate: i.price.taxRate });
      amounts.push(a);
      lines.push({
        lineNo: ++n,
        orderItemId: i.id,
        productId: i.stockProductId,
        description: i.productName,
        uomCode: i.unit,
        quantity: qty,
        unitPrice: i.price.unitPrice,
        discountPct: i.price.discountPct,
        taxCode: i.price.taxCode,
        taxRate: i.price.taxRate,
        ...amountsData(a),
      });
    }
    if (lines.length === 0) throw new ApiError(409, "مفيش كميات خرجت تتفوتر");
    const currencyCode = order.items.find((i) => i.price)?.price?.currencyCode ?? "EGP";
    assertEgpCurrency(currencyCode, "فاتورة المبيعات");
    const invoice = await tx.salesInvoice.create({
      data: {
        customerId: order.customerAccountId,
        orderId,
        currencyCode,
        ...totalsData(sumAmounts(amounts)),
        createdById: actor.id,
        createdBy: actor.name,
        lines: { createMany: { data: lines } },
      },
    });
    await auditInv(tx, actor, "sales_invoice", invoice.id, "invoice_drafted", `${order.orderNumber} · ${invoice.total.toFixed(2)}`, orderId);
    return { invoice, created: true };
  });
}

export async function voidDraftInvoice(id: string, input: unknown, actor: ServiceActor) {
  assertPermission(actor, "sales.invoices.manage");
  const v = parse(z.object({ reason: text("سبب الإلغاء", 500), expected_version: version }), input);
  return inTx(async (tx) => {
    const inv = await tx.salesInvoice.findUnique({ where: { id } });
    if (!inv) throw new ApiError(404, "الفاتورة مش موجودة");
    if (inv.status !== "draft") throw new ApiError(409, inv.status === "issued" ? "الفاتورة صدرت — التصحيح بإشعار دائن" : "الفاتورة ملغية بالفعل");
    return voidDraft(tx, inv, v.reason, actor, v.expected_version);
  });
}

async function voidDraft(tx: Tx, inv: SalesInvoice, reason: string, actor: Actorish, expectedVersion?: number) {
  if (expectedVersion !== undefined && expectedVersion !== inv.version) throw new ApiError(409, "الفاتورة اتغيرت، حدّث الشاشة");
  const updated = await tx.salesInvoice.update({ where: { id: inv.id, version: inv.version, status: "draft" }, data: { status: "void", voidReason: reason, version: { increment: 1 } } });
  await auditInv(tx, actor, "sales_invoice", inv.id, "invoice_draft_voided", null, inv.orderId, reason);
  return updated;
}

/**
 * The order side of invoicing: an order taken back out of "dispatched" may not carry
 * an issued invoice (that needs a credit note first); a draft is simply voided.
 */
export async function releaseOrderInvoiceForReopen(tx: Tx, orderId: string, reason: string, actor: Actorish) {
  const live = await tx.salesInvoice.findMany({ where: { orderId, status: { not: "void" } } });
  for (const inv of live) {
    if (inv.status === "issued") throw new ApiError(409, `الأوردر عليه فاتورة ${inv.number} — اعمل إشعار دائن قبل إعادة الفتح`);
    await voidDraft(tx, inv, `الأوردر اتفتح تاني: ${reason}`, actor);
  }
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export async function issueInvoice(id: string, input: unknown, actor: ServiceActor) {
  assertPermission(actor, "sales.invoices.manage");
  const v = parse(
    z.object({ issue_date: z.string().refine(isValidISODate, "تاريخ الإصدار لازم يكون YYYY-MM-DD").optional(), notes: optText("ملاحظات", 2000).optional(), expected_version: version }),
    input
  );
  const today = todayLocalISO();
  const issueDate = v.issue_date ?? today;
  if (issueDate > today) throw new ApiError(400, "مينفعش تاريخ الفاتورة يكون في المستقبل");
  return inTx(async (tx) => {
    const inv = await tx.salesInvoice.findUnique({ where: { id }, include: { customer: true } });
    if (!inv) throw new ApiError(404, "الفاتورة مش موجودة");
    if (inv.status !== "draft") throw new ApiError(409, inv.status === "issued" ? "الفاتورة صدرت بالفعل" : "الفاتورة ملغية");
    if (v.expected_version !== undefined && v.expected_version !== inv.version) throw new ApiError(409, "الفاتورة اتغيرت، حدّث الشاشة");
    const c = inv.customer;
    const address = [c.address, c.area, c.city].filter(Boolean).join("، ") || null;
    const updated = await tx.salesInvoice.update({
      where: { id, version: inv.version, status: "draft" },
      data: {
        status: "issued",
        number: await nextDocumentNumber(tx, "sales.invoice", issueDate),
        issueDate,
        dueDate: addDays(issueDate, c.paymentTermsDays),
        buyerName: c.nameAr ?? c.name,
        buyerTaxId: c.taxRegistrationNo,
        buyerAddress: address,
        notes: v.notes ?? inv.notes,
        issuedById: actor.id,
        issuedBy: actor.name,
        issuedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await auditInv(tx, actor, "sales_invoice", id, "invoice_issued", `${updated.number} · ${updated.total.toFixed(2)} · استحقاق ${updated.dueDate}`, inv.orderId);
    await postSalesInvoice(tx, id, actor);
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Credit notes
// ---------------------------------------------------------------------------

const creditInput = z.object({
  reason: text("سبب الإشعار", 500),
  /** Credit every line in full (the whole invoice). */
  full: z.boolean().optional(),
  lines: z
    .array(
      z.object({
        invoice_line_id: text("السطر"),
        quantity: z.union([z.number(), z.string()]).transform((v, ctx) => {
          const s = typeof v === "number" ? String(v) : v.trim();
          if (!/^\d+(\.\d{1,3})?$/.test(s) || Number(s) <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "الكمية لازم تكون أكبر من صفر وبحد أقصى 3 خانات" });
            return z.NEVER;
          }
          return new Prisma.Decimal(s);
        }),
      })
    )
    .optional(),
  return_document_id: z.string().optional(),
  /** The credited goods came back: put them into stock (quarantine) in the same step. */
  restock: z.boolean().optional(),
  idempotency_key: idempotencyKeyField,
});

/** The same credit note again: same invoice, and (unless "the whole invoice") the same lines and quantities. */
function sameCredit(prev: { invoiceId: string; reason: string; returnDocumentId: string | null; lines: { invoiceLineId: string; quantity: Prisma.Decimal }[] }, invoiceId: string, v: { reason: string; full?: boolean; restock?: boolean; return_document_id?: string; lines?: { invoice_line_id: string; quantity: Prisma.Decimal }[] }) {
  if (prev.invoiceId !== invoiceId || prev.reason !== v.reason) return false;
  if (v.return_document_id && prev.returnDocumentId !== v.return_document_id) return false;
  if (v.restock && !prev.returnDocumentId) return false;
  if (!v.restock && !v.return_document_id && prev.returnDocumentId) return false;
  if (v.full) return true;
  const sum = (xs: [string, Prisma.Decimal][]) => [...xs.reduce((m, [k, q]) => m.set(k, (m.get(k) ?? D(0)).plus(q)), new Map<string, Prisma.Decimal>())].map(([k, q]) => `${k}:${q.toFixed(3)}`).sort().join("|");
  return sum(prev.lines.map((l) => [l.invoiceLineId, D(l.quantity)])) === sum((v.lines ?? []).map((l) => [l.invoice_line_id, l.quantity]));
}

export async function createCreditNote(invoiceId: string, input: unknown, actor: ServiceActor) {
  assertPermission(actor, "sales.invoices.manage");
  const v = parse(creditInput, input);
  const requestHash = requestFingerprint({ invoiceId, request: v });
  if (!v.full && !v.lines?.length) throw new ApiError(400, "حدد السطور اللي هتتخصم أو اختار الفاتورة كلها");
  return inTx(async (tx) => {
    await lockKey(tx, v.idempotency_key);
    if (v.idempotency_key) {
      const prev = await tx.creditNote.findUnique({ where: { idempotencyKey: v.idempotency_key }, include: { lines: true } });
      if (prev) return replayRequest(prev, requestHash, sameCredit(prev, invoiceId, v));
    }
    // Serialises credit notes of one invoice: the "never more than invoiced" check
    // and the insert are one step.
    await advisoryXactLock(tx, `sales:credit-note:${invoiceId}`);
    const inv = await tx.salesInvoice.findUnique({ where: { id: invoiceId }, include: { lines: { orderBy: { lineNo: "asc" } } } });
    if (!inv) throw new ApiError(404, "الفاتورة مش موجودة");
    if (inv.status !== "issued") throw new ApiError(409, "الإشعار الدائن بيتعمل على فاتورة صادرة بس");
    if (v.return_document_id) {
      const doc = await tx.inventoryDocument.findUnique({ where: { id: v.return_document_id } });
      if (!doc || doc.type !== "customer_return") throw new ApiError(400, "مستند المرتجع مش موجود");
    }
    const credited = await tx.creditNoteLine.groupBy({ by: ["invoiceLineId"], where: { invoiceLineId: { in: inv.lines.map((l) => l.id) } }, _sum: { quantity: true } });
    const already = new Map(credited.map((c) => [c.invoiceLineId, D(c._sum.quantity ?? 0)]));
    const wanted = v.full
      ? inv.lines.map((l) => ({ line: l, qty: D(l.quantity).minus(already.get(l.id) ?? 0) })).filter((x) => x.qty.gt(0))
      : v.lines!.map((x) => {
          const line = inv.lines.find((l) => l.id === x.invoice_line_id);
          if (!line) throw new ApiError(400, "السطر مش تابع للفاتورة");
          return { line, qty: x.quantity };
        });
    if (wanted.length === 0) throw new ApiError(409, "الفاتورة متخصومة بالكامل بالفعل");
    const perLine = new Map<string, Prisma.Decimal>();
    for (const w of wanted) perLine.set(w.line.id, (perLine.get(w.line.id) ?? D(0)).plus(w.qty));
    for (const [lineId, qty] of perLine) {
      const line = inv.lines.find((l) => l.id === lineId)!;
      const left = D(line.quantity).minus(already.get(lineId) ?? 0);
      if (qty.greaterThan(left)) throw new ApiError(400, `"${line.description}": المتبقي من الفاتورة ${left.toFixed()} ${line.uomCode} بس`);
    }
    // A full credit of what remains is exact to the piastre: the remaining amount of
    // each line, not a re-rounded recomputation.
    const amounts: { lineId: string; qty: Prisma.Decimal; a: LineAmounts }[] = [];
    for (const [lineId, qty] of perLine) {
      const line = inv.lines.find((l) => l.id === lineId)!;
      const left = D(line.quantity).minus(already.get(lineId) ?? 0);
      let a: LineAmounts;
      if (qty.equals(left)) {
        const prior = await tx.creditNoteLine.aggregate({ where: { invoiceLineId: lineId }, _sum: { gross: true, discount: true, net: true, tax: true, total: true } });
        a = {
          gross: D(line.gross).minus(prior._sum.gross ?? 0),
          discount: D(line.discount).minus(prior._sum.discount ?? 0),
          net: D(line.net).minus(prior._sum.net ?? 0),
          tax: D(line.tax).minus(prior._sum.tax ?? 0),
          total: D(line.total).minus(prior._sum.total ?? 0),
        };
      } else {
        a = lineAmounts({ quantity: qty, unitPrice: line.unitPrice, discountPct: line.discountPct, taxRate: line.taxRate });
      }
      amounts.push({ lineId, qty, a });
    }
    const totals = sumAmounts(amounts.map((x) => x.a));
    if (!totals.total.gt(0)) throw new ApiError(400, "قيمة الإشعار صفر");
    const today = todayLocalISO();
    if (v.restock && v.return_document_id) throw new ApiError(400, "يا إما مرتجع موجود يا إما رجّع البضاعة دلوقتي — مش الاتنين");
    let returnDocumentId = v.return_document_id ?? null;
    if (v.restock) {
      // Goods back in stock and the customer credited: one transaction, linked both ways.
      const back = amounts.map((x) => ({ line: inv.lines.find((l) => l.id === x.lineId)!, qty: x.qty })).filter((x) => x.line.productId);
      if (!back.length) throw new ApiError(400, "مفيش أصناف مخزنية في السطور دي ترجع المخزن");
      const doc = await postCustomerReturnInTx(tx, { order_id: inv.orderId ?? undefined, reason: `مرتجع على ${inv.number}: ${v.reason}`, business_date: today, lines: back.map((x) => ({ product_id: x.line.productId, quantity: x.qty.toString(), uom: x.line.uomCode })) }, actor);
      returnDocumentId = doc.id;
    }
    const cn = await tx.creditNote.create({
      data: {
        number: await nextDocumentNumber(tx, "sales.credit_note", today),
        invoiceId,
        customerId: inv.customerId,
        issueDate: today,
        reason: v.reason,
        returnDocumentId,
        idempotencyKey: v.idempotency_key ?? null,
        requestHash,
        currencyCode: inv.currencyCode,
        ...totalsData(totals),
        createdById: actor.id,
        createdBy: actor.name,
        lines: { createMany: { data: amounts.map((x) => ({ invoiceLineId: x.lineId, quantity: x.qty, ...amountsData(x.a) })) } },
      },
    });
    await auditInv(tx, actor, "credit_note", cn.id, "credit_note_issued", `${cn.number} على ${inv.number} · ${cn.total.toFixed(2)}`, inv.orderId, v.reason);
    await postCreditNote(tx, cn.id, actor);
    return cn;
  });
}

// ---------------------------------------------------------------------------
// Reads: invoices, receivables, statement, aging
// ---------------------------------------------------------------------------

/** What has been taken off each issued invoice: credit notes + receipts allocated to it. */
async function openAmounts(db: Pick<Tx, "creditNote" | "receiptAllocation">, invoiceIds: string[]) {
  const [credits, paid] = invoiceIds.length
    ? await Promise.all([
        db.creditNote.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invoiceIds } }, _sum: { total: true } }),
        db.receiptAllocation.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invoiceIds }, receipt: { reversal: { is: null } } }, _sum: { amount: true } }),
      ])
    : [[], []];
  const out = new Map<string, Prisma.Decimal>();
  for (const c of credits) out.set(c.invoiceId, (out.get(c.invoiceId) ?? D(0)).plus(c._sum.total ?? 0));
  for (const p of paid) if (p.invoiceId) out.set(p.invoiceId, (out.get(p.invoiceId) ?? D(0)).plus(p._sum.amount ?? 0));
  return out;
}

export async function listInvoices(filters: { status?: string; customerId?: string; orderId?: string }) {
  const rows = await prisma.salesInvoice.findMany({
    where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}), ...(filters.orderId ? { orderId: filters.orderId } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    include: { customer: { select: { code: true, name: true, nameAr: true } }, order: { select: { orderNumber: true } } },
  });
  const credited = await openAmounts(prisma, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, credited: (credited.get(r.id) ?? D(0)).toFixed(2), open: r.status === "issued" ? r.total.minus(credited.get(r.id) ?? 0).toFixed(2) : null }));
}

export async function getInvoice(id: string) {
  const inv = await prisma.salesInvoice.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, code: true, name: true, nameAr: true, taxRegistrationNo: true, paymentTermsDays: true } },
      order: { select: { id: true, orderNumber: true, deliveryDate: true } },
      lines: { orderBy: { lineNo: "asc" }, include: { creditLines: { select: { quantity: true } } } },
      creditNotes: { orderBy: { createdAt: "asc" }, include: { lines: true } },
      receiptAllocations: { where: { receipt: { reversal: { is: null } } }, include: { receipt: { select: { id: true, number: true, date: true } } } },
    },
  });
  if (!inv) throw new ApiError(404, "الفاتورة مش موجودة");
  const credited = inv.creditNotes.reduce((s, c) => s.plus(c.total), D(0));
  const paid = inv.receiptAllocations.reduce((s, a) => s.plus(a.amount), D(0));
  return {
    ...inv,
    lines: inv.lines.map((l) => ({ ...l, creditedQty: l.creditLines.reduce((s, c) => s.plus(c.quantity), D(0)).toString(), creditLines: undefined })),
    credited: credited.toFixed(2),
    paid: paid.toFixed(2),
    payments: inv.receiptAllocations.map((a) => ({ receiptId: a.receipt.id, number: a.receipt.number, date: a.receipt.date, amount: a.amount.toFixed(2) })),
    receiptAllocations: undefined,
    open: inv.status === "issued" ? inv.total.minus(credited).minus(paid).toFixed(2) : null,
  };
}

/** Dispatched orders with no live invoice yet — the accountant's to-do list. */
export async function ordersToInvoice() {
  const orders = await prisma.order.findMany({
    // Trip orders wait for their delivery result; a failed delivery has nothing to invoice.
    where: { status: "dispatched", invoices: { none: { status: { not: "void" } } }, tripStops: { none: { active: true, status: { in: ["pending", "failed"] } } } },
    orderBy: { deliveryDate: "asc" },
    take: 300,
    select: { id: true, orderNumber: true, deliveryDate: true, customerName: true, customerAccountId: true, customerAccount: { select: { code: true, name: true, nameAr: true } }, items: { select: { id: true, price: { select: { orderItemId: true } }, loadedQuantity: true, preparedQuantity: true, requiredQuantity: true } } },
  });
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    deliveryDate: o.deliveryDate,
    customerName: o.customerName,
    customer: o.customerAccount,
    unpricedLines: o.items.filter((i) => !i.price && (i.loadedQuantity ?? i.preparedQuantity ?? i.requiredQuantity) > 0).length,
  }));
}

/** Issued invoices − credit notes − receipts for a customer (what they owe us now). */
export async function customerReceivable(db: Pick<Tx, "salesInvoice" | "creditNote" | "customerReceipt" | "partyOpeningBalance" | "customerRefund">, customerId: string) {
  const [inv, cn, rc, ob, back, paidBack] = await Promise.all([
    db.salesInvoice.aggregate({ where: { customerId, status: "issued" }, _sum: { total: true } }),
    db.creditNote.aggregate({ where: { customerId }, _sum: { total: true } }),
    db.customerReceipt.aggregate({ where: { customerId }, _sum: { amount: true } }),
    db.partyOpeningBalance.aggregate({ where: { partyType: "customer", partyId: customerId }, _sum: { amount: true } }),
    db.customerReceipt.aggregate({ where: { customerId, reversal: { isNot: null } }, _sum: { amount: true } }),
    db.customerRefund.aggregate({ where: { customerId }, _sum: { amount: true } }),
  ]);
  // A reversed receipt still counts as received on its date; its reversal adds it back.
  // Money refunded to the customer uses up credit they held: it adds back too.
  return D(inv._sum.total ?? 0).minus(cn._sum.total ?? 0).minus(rc._sum.amount ?? 0).plus(ob._sum.amount ?? 0).plus(back._sum.amount ?? 0).plus(paidBack._sum.amount ?? 0);
}

/** Every invoice and credit note of a customer in a period, with a running balance. */
export async function customerStatement(customerId: string, from: string, to: string) {
  if (!isValidISODate(from) || !isValidISODate(to) || from > to) throw new ApiError(400, "الفترة غير صالحة");
  const c = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!c) throw new ApiError(404, "العميل مش موجود");
  const [refBefore, refs, revBefore, revs, obBefore, obs, invBefore, cnBefore, rcBefore, rcs, invs, cns] = await Promise.all([
    prisma.customerRefund.aggregate({ where: { customerId, date: { lt: from } }, _sum: { amount: true } }),
    prisma.customerRefund.findMany({ where: { customerId, date: { gte: from, lte: to } }, select: { id: true, number: true, date: true, amount: true, reason: true, createdAt: true } }),
    prisma.customerReceipt.aggregate({ where: { customerId, reversal: { is: { date: { lt: from } } } }, _sum: { amount: true } }),
    prisma.customerReceiptReversal.findMany({ where: { receipt: { customerId }, date: { gte: from, lte: to } }, include: { receipt: { select: { number: true, amount: true } } } }),
    prisma.partyOpeningBalance.aggregate({ where: { partyType: "customer", partyId: customerId, date: { lt: from } }, _sum: { amount: true } }),
    prisma.partyOpeningBalance.findMany({ where: { partyType: "customer", partyId: customerId, date: { gte: from, lte: to } } }),
    prisma.salesInvoice.aggregate({ where: { customerId, status: "issued", issueDate: { lt: from } }, _sum: { total: true } }),
    prisma.creditNote.aggregate({ where: { customerId, issueDate: { lt: from } }, _sum: { total: true } }),
    prisma.customerReceipt.aggregate({ where: { customerId, date: { lt: from } }, _sum: { amount: true } }),
    prisma.customerReceipt.findMany({ where: { customerId, date: { gte: from, lte: to } }, select: { id: true, number: true, date: true, amount: true, method: true, reference: true, createdAt: true } }),
    prisma.salesInvoice.findMany({ where: { customerId, status: "issued", issueDate: { gte: from, lte: to } }, select: { id: true, number: true, issueDate: true, dueDate: true, total: true, issuedAt: true } }),
    prisma.creditNote.findMany({ where: { customerId, issueDate: { gte: from, lte: to } }, select: { id: true, number: true, issueDate: true, total: true, reason: true, createdAt: true, invoice: { select: { number: true } } } }),
  ]);
  const opening = D(invBefore._sum.total ?? 0).minus(cnBefore._sum.total ?? 0).minus(rcBefore._sum.amount ?? 0).plus(obBefore._sum.amount ?? 0).plus(revBefore._sum.amount ?? 0).plus(refBefore._sum.amount ?? 0);
  const entries = [
    ...refs.map((f) => ({ date: f.date, at: f.createdAt.getTime(), kind: "refund" as const, id: f.id, number: f.number, ref: `رد مبلغ · ${f.reason}`, debit: f.amount, credit: D(0) })),
    ...revs.map((r) => ({ date: r.date, at: r.createdAt.getTime(), kind: "receipt_reversal" as const, id: r.id, number: r.receipt.number, ref: `عكس تحصيل · ${r.reason}`, debit: r.receipt.amount, credit: D(0) })),
    ...invs.map((i) => ({ date: i.issueDate!, at: i.issuedAt!.getTime(), kind: "invoice" as const, id: i.id, number: i.number!, ref: `استحقاق ${i.dueDate}`, debit: i.total, credit: D(0) })),
    ...cns.map((n) => ({ date: n.issueDate, at: n.createdAt.getTime(), kind: "credit_note" as const, id: n.id, number: n.number, ref: `${n.invoice.number} · ${n.reason}`, debit: D(0), credit: n.total })),
    ...obs.map((o) => ({ date: o.date, at: o.createdAt.getTime(), kind: "opening_balance" as const, id: o.id, number: "رصيد افتتاحي", ref: o.reference ?? "", debit: o.amount.gt(0) ? o.amount : D(0), credit: o.amount.lt(0) ? o.amount.negated() : D(0) })),
    ...rcs.map((r) => ({ date: r.date, at: r.createdAt.getTime(), kind: "receipt" as const, id: r.id, number: r.number, ref: `تحصيل${r.reference ? ` · ${r.reference}` : ""}`, debit: D(0), credit: r.amount })),
    // Same day: in the order they were made (a credit note always follows its invoice).
  ].sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
  let bal = opening;
  const rows = entries.map((e) => {
    bal = bal.plus(e.debit).minus(e.credit);
    return { date: e.date, kind: e.kind, id: e.id, number: e.number, ref: e.ref, debit: e.debit.toFixed(2), credit: e.credit.toFixed(2), balance: bal.toFixed(2) };
  });
  return { customer: { id: c.id, code: c.code, name: c.nameAr ?? c.name }, from, to, opening: opening.toFixed(2), closing: bal.toFixed(2), rows };
}

/** Open receivables by how overdue they are, per customer, as of a date. */
export async function agingReport(asOf = todayLocalISO()) {
  const invs = await prisma.salesInvoice.findMany({
    where: { status: "issued", issueDate: { lte: asOf } },
    select: { id: true, number: true, customerId: true, dueDate: true, total: true, customer: { select: { code: true, name: true, nameAr: true } } },
  });
  const credits = await openAmounts(prisma, invs.map((i) => i.id));
  const buckets = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const;
  const byCustomer = new Map<string, { customer: { id: string; code: string; name: string }; total: Prisma.Decimal } & Record<(typeof buckets)[number], Prisma.Decimal>>();
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
  // A credit note on an invoice that was already paid leaves it below zero: that is credit
  // the customer holds, on account like unapplied money — never dropped from the aging.
  const unapplied = new Map<string, Prisma.Decimal>();
  for (const i of invs) {
    const open = i.total.minus(credits.get(i.id) ?? 0);
    if (open.lt(0)) {
      unapplied.set(i.customerId, (unapplied.get(i.customerId) ?? D(0)).plus(open.negated()));
      if (!byCustomer.has(i.customerId)) byCustomer.set(i.customerId, { customer: { id: i.customerId, code: i.customer.code, name: i.customer.nameAr ?? i.customer.name }, total: D(0), current: D(0), d1_30: D(0), d31_60: D(0), d61_90: D(0), d90_plus: D(0) });
    }
    if (!open.gt(0)) continue;
    const overdue = day(asOf) - day(i.dueDate!);
    const b = overdue <= 0 ? "current" : overdue <= 30 ? "d1_30" : overdue <= 60 ? "d31_60" : overdue <= 90 ? "d61_90" : "d90_plus";
    const row = byCustomer.get(i.customerId) ?? { customer: { id: i.customerId, code: i.customer.code, name: i.customer.nameAr ?? i.customer.name }, total: D(0), current: D(0), d1_30: D(0), d31_60: D(0), d61_90: D(0), d90_plus: D(0) };
    row[b] = row[b].plus(open);
    row.total = row.total.plus(open);
    byCustomer.set(i.customerId, row);
  }
  // Balances brought over at go-live age from their own due date. Receipts allocated
  // to an opening item reduce that item in aging just like an invoice allocation.
  const openingBalances = await prisma.partyOpeningBalance.findMany({ where: { partyType: "customer", date: { lte: asOf } } });
  const openingIds = openingBalances.map((o) => o.id);
  const openingAllocations = openingIds.length ? await prisma.receiptAllocation.groupBy({
    by: ["openingBalanceId"],
    where: { openingBalanceId: { in: openingIds }, receipt: { date: { lte: asOf }, reversal: { is: null } } },
    _sum: { amount: true },
  }) : [];
  const openingAllocatedBy = new Map(openingAllocations.map((a) => [a.openingBalanceId!, D(a._sum.amount ?? 0)]));
  for (const o of openingBalances) {
    const c = await prisma.customer.findUnique({ where: { id: o.partyId }, select: { code: true, name: true, nameAr: true } });
    const open = o.amount.minus(openingAllocatedBy.get(o.id) ?? 0);
    if (!open.isZero()) {
      if (open.lt(0)) {
        unapplied.set(o.partyId, (unapplied.get(o.partyId) ?? D(0)).plus(open.negated()));
        if (!byCustomer.has(o.partyId)) byCustomer.set(o.partyId, { customer: { id: o.partyId, code: c?.code ?? "", name: c?.nameAr ?? c?.name ?? "" }, total: D(0), current: D(0), d1_30: D(0), d31_60: D(0), d61_90: D(0), d90_plus: D(0) });
      } else {
        const overdue = day(asOf) - day(o.dueDate);
        const b = overdue <= 0 ? "current" : overdue <= 30 ? "d1_30" : overdue <= 60 ? "d31_60" : overdue <= 90 ? "d61_90" : "d90_plus";
        const row = byCustomer.get(o.partyId) ?? { customer: { id: o.partyId, code: c?.code ?? "", name: c?.nameAr ?? c?.name ?? "" }, total: D(0), current: D(0), d1_30: D(0), d31_60: D(0), d61_90: D(0), d90_plus: D(0) };
        row[b] = row[b].plus(open);
        row.total = row.total.plus(open);
        byCustomer.set(o.partyId, row);
      }
    }
  }
  // Money received but not yet applied to an invoice reduces what the customer owes.
  const receipts = await prisma.customerReceipt.findMany({ where: { date: { lte: asOf }, reversal: { is: null } }, select: { customerId: true, amount: true, allocations: { select: { amount: true } }, customer: { select: { code: true, name: true, nameAr: true } } } });
  for (const r of receipts) {
    const left = r.amount.minus(r.allocations.reduce((s, a) => s.plus(a.amount), D(0)));
    if (!left.gt(0)) continue;
    unapplied.set(r.customerId, (unapplied.get(r.customerId) ?? D(0)).plus(left));
    if (!byCustomer.has(r.customerId)) byCustomer.set(r.customerId, { customer: { id: r.customerId, code: r.customer.code, name: r.customer.nameAr ?? r.customer.name }, total: D(0), current: D(0), d1_30: D(0), d31_60: D(0), d61_90: D(0), d90_plus: D(0) });
  }
  // Money refunded uses up the customer's credit first; anything beyond it (credit that
  // came from an opening balance in their favour) is owed again from today.
  for (const f of await prisma.customerRefund.groupBy({ by: ["customerId"], where: { date: { lte: asOf } }, _sum: { amount: true } })) {
    const amt = D(f._sum.amount ?? 0);
    const held = unapplied.get(f.customerId) ?? D(0);
    const used = Prisma.Decimal.min(held, amt);
    unapplied.set(f.customerId, held.minus(used));
    const rest = amt.minus(used);
    if (rest.gt(0)) {
      const c = await prisma.customer.findUnique({ where: { id: f.customerId }, select: { code: true, name: true, nameAr: true } });
      const row = byCustomer.get(f.customerId) ?? { customer: { id: f.customerId, code: c?.code ?? "", name: c?.nameAr ?? c?.name ?? "" }, total: D(0), current: D(0), d1_30: D(0), d31_60: D(0), d61_90: D(0), d90_plus: D(0) };
      row.current = row.current.plus(rest);
      row.total = row.total.plus(rest);
      byCustomer.set(f.customerId, row);
    }
  }
  for (const [id, u] of unapplied) byCustomer.get(id)!.total = byCustomer.get(id)!.total.minus(u);
  const rows = [...byCustomer.values()].sort((a, b) => Number(b.total.minus(a.total)));
  const sum = (k: (typeof buckets)[number] | "total") => rows.reduce((s, r) => s.plus(r[k]), D(0)).toFixed(2);
  return {
    asOf,
    rows: rows.map((r) => ({ customer: r.customer, unapplied: (unapplied.get(r.customer.id) ?? D(0)).toFixed(2), total: r.total.toFixed(2), current: r.current.toFixed(2), d1_30: r.d1_30.toFixed(2), d31_60: r.d31_60.toFixed(2), d61_90: r.d61_90.toFixed(2), d90_plus: r.d90_plus.toFixed(2) })),
    totals: { total: sum("total"), current: sum("current"), d1_30: sum("d1_30"), d31_60: sum("d31_60"), d61_90: sum("d61_90"), d90_plus: sum("d90_plus") },
  };
}
