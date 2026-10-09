import { Prisma, type Quotation } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";
import { assertEgpCurrency } from "@/lib/core/currency";
import { writeAudit } from "@/lib/audit";
import { assertPermission, actorCan } from "@/lib/authz-core";
import { advisoryXactLock } from "@/lib/dbLock";
import { inTx, type Tx } from "@/lib/tx";
import { todayLocalISO } from "@/lib/localDate";
import { isValidISODate } from "@/lib/dates";
import { getSetting } from "@/lib/core/settings-service";
import { nextDocumentNumber } from "@/lib/core/sequences";
import { optText, parse, text, version } from "@/lib/core/validation";
import type { ServiceActor } from "@/lib/core/actor";
import { createOrder } from "@/lib/orders-service";
import { amountsJSON, lineAmounts, sumAmounts } from "@/lib/sales/money";
import { effectivePrice, priceListsFor } from "@/lib/sales/pricing";

/**
 * Quotations: a priced offer to a known customer, valid until a date.
 *
 *   draft ──send──▶ sent ──accept──▶ accepted ──convert──▶ converted (→ one order)
 *     │               ├──reject──▶ rejected
 *     └──────────── cancel (from draft / sent / accepted)
 *
 * "Expired" is not stored: a draft, sent or accepted quotation past its validUntil is
 * expired by definition and can no longer be sent, accepted or converted.
 *
 * Lines are priced from the customer's lists at creation (or by hand with
 * sales.price_override). Converting creates the order through the one order-creation
 * path, with the quotation's prices on its lines, in the same transaction that marks
 * the quotation converted — so a quotation becomes at most one order.
 */

const qty = (label: string) =>
  z.union([z.number(), z.string()]).transform((v, ctx) => {
    const s = typeof v === "number" ? String(v) : v.trim();
    if (!/^\d+(\.\d{1,3})?$/.test(s) || Number(s) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} لازم يكون أكبر من صفر وبحد أقصى 3 خانات عشرية` });
      return z.NEVER;
    }
    return new Prisma.Decimal(s);
  });
const money = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const s = typeof v === "number" ? String(v) : v.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(s)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "السعر لازم يكون رقم موجب بحد أقصى 4 خانات عشرية" });
    return z.NEVER;
  }
  return new Prisma.Decimal(s);
});
const pct = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const s = typeof v === "number" ? String(v) : v.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s) || Number(s) > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "الخصم لازم يكون بين 0 و 100" });
    return z.NEVER;
  }
  return new Prisma.Decimal(s);
});
const isoDate = (label: string) => z.string().refine(isValidISODate, `${label} لازم يكون تاريخ YYYY-MM-DD`);

const lineInput = z.object({
  product_id: text("الصنف"),
  quantity: qty("الكمية"),
  uom: z.string().trim().optional(),
  unit_price: money.optional(),
  discount_pct: pct.optional(),
  notes: optText("ملاحظة").optional(),
});
const quotationInput = z.object({
  customer_id: text("العميل"),
  valid_until: isoDate("صالح لحد").optional(),
  delivery_date: isoDate("تاريخ التسليم").nullable().optional(),
  notes: optText("ملاحظات", 2000).optional(),
  lines: z.array(lineInput).min(1, "لازم سطر واحد على الأقل").max(200),
  expected_version: version,
});

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isExpired(q: Pick<Quotation, "status" | "validUntil">, today = todayLocalISO()) {
  return ["draft", "sent", "accepted"].includes(q.status) && q.validUntil < today;
}

type Actorish = ServiceActor;
const auditQ = (tx: Tx, actor: Actorish, q: { id: string; number: string }, action: string, detail: string | null, reason?: string | null) =>
  writeAudit(
    { userId: actor.id, userName: actor.name, role: actor.role, action, entityType: "quotation", entityId: q.id, fieldChanged: q.number, newValue: detail, reason: reason ?? undefined, source: "user", deviceId: actor.deviceId },
    tx
  );

/** Prices and validates lines against the customer's lists. */
async function buildLines(tx: Tx, customerId: string, date: string, lines: z.infer<typeof lineInput>[], actor: Actorish) {
  const lists = await priceListsFor(tx, customerId);
  const out: Prisma.QuotationLineCreateManyQuotationInput[] = [];
  let n = 0;
  for (const l of lines) {
    const product = await tx.stockProduct.findUnique({ where: { id: l.product_id }, include: { salesTax: true } });
    if (!product || !product.active) throw new ApiError(400, "صنف مش موجود أو موقوف");
    const uom = l.uom || product.unit;
    let listPrice: Prisma.Decimal | null = null;
    for (const pl of lists) {
      const found = await effectivePrice(tx, { priceListId: pl.id, product, lineUom: uom, date });
      if (found) {
        listPrice = found.unitPrice;
        break;
      }
    }
    const discount = l.discount_pct ?? new Prisma.Decimal(0);
    const manual = (l.unit_price !== undefined && (listPrice === null || !l.unit_price.equals(listPrice))) || discount.gt(0);
    if (manual && !actorCan(actor, "sales.price_override")) throw new ApiError(403, `تغيير سعر "${product.name}" أو خصمه محتاج صلاحية تعديل الأسعار`);
    const unitPrice = l.unit_price ?? listPrice;
    if (unitPrice === null) throw new ApiError(400, `مفيش سعر لـ"${product.name}" (${uom}) في ${date} — اكتب السعر`);
    if (uom !== product.unit) {
      const ok = await tx.productPackaging.findUnique({ where: { productId_uomCode: { productId: product.id, uomCode: uom } } });
      const u = await tx.unitOfMeasure.findUnique({ where: { code: uom } });
      const base = await tx.unitOfMeasure.findUnique({ where: { code: product.unit } });
      if (!ok?.active && !(u && base && u.category === base.category && u.category !== "package")) throw new ApiError(400, `الوحدة ${uom} مش متعرّفة للصنف "${product.name}"`);
    }
    out.push({
      lineNo: ++n,
      productId: product.id,
      uomCode: uom,
      quantity: l.quantity,
      unitPrice,
      discountPct: discount,
      taxCode: product.salesTaxCode,
      taxRate: product.salesTax.rate,
      priceSource: manual ? "manual" : "list",
      notes: l.notes ?? null,
    });
  }
  return out;
}

export async function createQuotation(input: unknown, actor: ServiceActor) {
  assertPermission(actor, "sales.quotations.manage");
  const v = parse(quotationInput, input);
  const validity = await getSetting("sales.quotation_validity_days");
  const today = todayLocalISO();
  const validUntil = v.valid_until ?? addDays(today, validity);
  if (validUntil < today) throw new ApiError(400, "تاريخ الصلاحية فات");
  return inTx(async (tx) => {
    const c = await tx.customer.findUnique({ where: { id: v.customer_id } });
    if (!c || !c.active) throw new ApiError(400, "العميل مش موجود أو موقوف");
    assertEgpCurrency(c.currencyCode, "عرض السعر");
    const lines = await buildLines(tx, c.id, v.delivery_date ?? today, v.lines, actor);
    const q = await tx.quotation.create({
      data: {
        number: await nextDocumentNumber(tx, "sales.quotation", today),
        customerId: c.id,
        validUntil,
        deliveryDate: v.delivery_date ?? null,
        currencyCode: c.currencyCode,
        notes: v.notes ?? null,
        createdById: actor.id,
        createdBy: actor.name,
        lines: { createMany: { data: lines } },
      },
    });
    await auditQ(tx, actor, q, "quotation_created", `${c.code} · ${lines.length} سطر`);
    return q;
  });
}

/** A draft may be rewritten (lines replaced) until it is sent. */
export async function updateQuotation(id: string, input: unknown, actor: ServiceActor) {
  assertPermission(actor, "sales.quotations.manage");
  const v = parse(quotationInput, input);
  return inTx(async (tx) => {
    await advisoryXactLock(tx, `sales:quotation:${id}`);
    const q = await tx.quotation.findUnique({ where: { id } });
    if (!q) throw new ApiError(404, "عرض السعر مش موجود");
    if (q.status !== "draft") throw new ApiError(409, "عرض السعر اتبعت — التعديل بعرض جديد");
    if (v.expected_version !== undefined && v.expected_version !== q.version) throw new ApiError(409, "عرض السعر اتغير، حدّث الشاشة");
    if (v.customer_id !== q.customerId) throw new ApiError(400, "مينفعش تغيّر العميل — اعمل عرض جديد");
    const lines = await buildLines(tx, q.customerId, v.delivery_date ?? todayLocalISO(), v.lines, actor);
    await tx.quotationLine.deleteMany({ where: { quotationId: id } });
    const updated = await tx.quotation.update({
      where: { id, version: q.version },
      data: { validUntil: v.valid_until ?? q.validUntil, deliveryDate: v.delivery_date ?? null, notes: v.notes ?? null, version: { increment: 1 }, lines: { createMany: { data: lines } } },
    });
    await auditQ(tx, actor, q, "quotation_edited", `${lines.length} سطر`);
    return updated;
  });
}

const TRANSITIONS: Record<string, { from: string[]; to: string; action: string; needsNote?: boolean }> = {
  send: { from: ["draft"], to: "sent", action: "quotation_sent" },
  accept: { from: ["sent"], to: "accepted", action: "quotation_accepted" },
  reject: { from: ["sent"], to: "rejected", action: "quotation_rejected", needsNote: true },
  cancel: { from: ["draft", "sent", "accepted"], to: "cancelled", action: "quotation_cancelled", needsNote: true },
};

export async function transitionQuotation(id: string, input: unknown, actor: ServiceActor) {
  assertPermission(actor, "sales.quotations.manage");
  const v = parse(z.object({ action: z.string(), note: optText("ملاحظة", 1000).optional(), expected_version: version }), input);
  const t = TRANSITIONS[v.action];
  if (!t) throw new ApiError(400, "الإجراء لازم يكون send أو accept أو reject أو cancel");
  if (t.needsNote && !v.note) throw new ApiError(400, "اكتب السبب");
  return inTx(async (tx) => {
    await advisoryXactLock(tx, `sales:quotation:${id}`);
    const q = await tx.quotation.findUnique({ where: { id } });
    if (!q) throw new ApiError(404, "عرض السعر مش موجود");
    if (v.expected_version !== undefined && v.expected_version !== q.version) throw new ApiError(409, "عرض السعر اتغير، حدّث الشاشة");
    if (!t.from.includes(q.status)) throw new ApiError(409, `مينفعش ${v.action} لعرض حالته ${q.status}`);
    if (v.action !== "cancel" && isExpired(q)) throw new ApiError(409, `عرض السعر انتهت صلاحيته في ${q.validUntil}`);
    const updated = await tx.quotation.update({ where: { id, version: q.version }, data: { status: t.to, decisionNote: v.note ?? q.decisionNote, version: { increment: 1 } } });
    await auditQ(tx, actor, q, t.action, `${q.status} → ${t.to}`, v.note);
    return updated;
  });
}

/**
 * Turns a sent or accepted quotation into an order, through the ordinary order
 * creation (numbering, product resolution, credit, reservations), with the quoted
 * prices on its lines. The quotation is marked converted in the same transaction.
 */
export async function convertQuotation(id: string, input: unknown, actor: ServiceActor) {
  assertPermission(actor, "sales.quotations.manage");
  assertPermission(actor, "orders.create");
  const v = parse(z.object({ delivery_date: isoDate("تاريخ التسليم").optional(), delivery_time: z.string().optional() }), input);
  const q = await prisma.quotation.findUnique({ where: { id }, include: { customer: true, lines: { include: { product: true }, orderBy: { lineNo: "asc" } } } });
  if (!q) throw new ApiError(404, "عرض السعر مش موجود");
  if (!["sent", "accepted"].includes(q.status)) throw new ApiError(409, q.status === "converted" ? "عرض السعر اتحوّل لأوردر بالفعل" : "بس العرض المبعوت أو المقبول يتحوّل لأوردر");
  if (isExpired(q)) throw new ApiError(409, `عرض السعر انتهت صلاحيته في ${q.validUntil}`);
  if (!q.customer.active) throw new ApiError(400, "العميل موقوف");
  const deliveryDate = v.delivery_date ?? q.deliveryDate ?? todayLocalISO();

  const order = await createOrder(
    {
      customer_account_id: q.customerId,
      customer_name: q.customer.nameAr ?? q.customer.name,
      delivery_date: deliveryDate,
      delivery_time: v.delivery_time,
      notes: `من عرض السعر ${q.number}${q.notes ? ` — ${q.notes}` : ""}`,
      items: q.lines.map((l) => ({ stock_product_id: l.productId, product_name: l.product.name, quantity: Number(l.quantity), unit: l.uomCode })),
    },
    { ...actor, source: "manual" },
    {
      afterCreate: async (tx, created) => {
        await advisoryXactLock(tx, `sales:quotation:${id}`);
        const fresh = await tx.quotation.findUniqueOrThrow({ where: { id } });
        if (!["sent", "accepted"].includes(fresh.status)) throw new ApiError(409, "عرض السعر اتحوّل أو اتغير في نفس اللحظة");
        // Each quoted line must have become a line naming the quoted product, in the
        // quoted unit and quantity (matched explicitly, never by position).
        const items = await tx.orderItem.findMany({ where: { orderId: created.id } });
        const unused = new Set(items.map((i) => i.id));
        for (const l of q.lines) {
          const item = items.find((i) => unused.has(i.id) && i.stockProductId === l.productId && i.unit === l.uomCode && new Prisma.Decimal(i.requiredQuantity).equals(l.quantity));
          if (!item) throw new ApiError(409, `الصنف "${l.product.name}" مااتعرفش في الأوردر — راجع دليل الأصناف`);
          unused.delete(item.id);
          const data = {
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            taxCode: l.taxCode,
            taxRate: l.taxRate,
            currencyCode: q.currencyCode,
            source: "quotation",
            priceListId: null,
            priceListItemId: null,
            reason: q.number,
            setById: actor.id,
            setBy: actor.name,
          };
          await tx.orderItemPrice.upsert({ where: { orderItemId: item.id }, create: { orderItemId: item.id, ...data }, update: { ...data, version: { increment: 1 } } });
        }
        await tx.quotation.update({ where: { id, version: fresh.version }, data: { status: "converted", orderId: created.id, version: { increment: 1 } } });
        await auditQ(tx, actor, q, "quotation_converted", created.orderNumber);
      },
    }
  );
  return order;
}

export async function listQuotations(filters: { status?: string; customerId?: string }) {
  const today = todayLocalISO();
  const rows = await prisma.quotation.findMany({
    where: {
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.status === "expired"
        ? { status: { in: ["draft", "sent", "accepted"] }, validUntil: { lt: today } }
        : filters.status
          ? { status: filters.status }
          : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { customer: { select: { code: true, name: true, nameAr: true } }, lines: true, order: { select: { id: true, orderNumber: true } } },
  });
  return rows.map((q) => ({ ...q, expired: isExpired(q, today), totals: amountsJSON(sumAmounts(q.lines.map((l) => lineAmounts({ quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxRate: l.taxRate })))), lines: undefined, lineCount: q.lines.length }));
}

export async function getQuotation(id: string) {
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: true, order: { select: { id: true, orderNumber: true, status: true } }, lines: { include: { product: { select: { name: true, nameAr: true, unit: true } } }, orderBy: { lineNo: "asc" } } },
  });
  if (!q) throw new ApiError(404, "عرض السعر مش موجود");
  const lines = q.lines.map((l) => ({ ...l, amounts: amountsJSON(lineAmounts({ quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxRate: l.taxRate })) }));
  const totals = amountsJSON(sumAmounts(q.lines.map((l) => lineAmounts({ quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxRate: l.taxRate }))));
  return { ...q, lines, totals, expired: isExpired(q) };
}
