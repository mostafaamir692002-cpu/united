import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { todayLocalISO } from "@/lib/localDate";

/**
 * Consolidated report of cancelled, voided and reversed transactions with
 * source-document traceability, original↔reversal links, dates and amounts.
 * Permission: accounting.manage — senior finance sees the full reversal picture.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.manage");
    const sp = new URL(req.url).searchParams;
    const to = sp.get("to") ?? todayLocalISO();
    const from = sp.get("from") ?? `${to.slice(0, 4)}-01-01`;

    type Row = { kind: string; id: string; number: string | null; date: string; amount: string; originalId: string | null; originalNumber: string | null; reason: string | null; user: string | null };
    const rows: Row[] = [];
    const add = (r: Row) => rows.push(r);

    // Debit notes (reverse of bill lines)
    for (const n of await prisma.debitNote.findMany({ where: { issueDate: { gte: from, lte: to } }, select: { id: true, number: true, issueDate: true, total: true, reason: true, billId: true, bill: { select: { number: true } } } }))
      add({ kind: "debit_note", id: n.id, number: n.number, date: n.issueDate, amount: n.total.toFixed(2), originalId: n.billId, originalNumber: n.bill?.number ?? null, reason: n.reason ?? null, user: null });

    // Credit notes (reverse of invoice lines)
    for (const n of await prisma.creditNote.findMany({ where: { issueDate: { gte: from, lte: to } }, select: { id: true, number: true, issueDate: true, total: true, reason: true, invoiceId: true, invoice: { select: { number: true } } } }))
      add({ kind: "credit_note", id: n.id, number: n.number, date: n.issueDate, amount: n.total.toFixed(2), originalId: n.invoiceId, originalNumber: n.invoice?.number ?? null, reason: n.reason ?? null, user: null });

    // Customer receipt reversals
    for (const r of await prisma.customerReceiptReversal.findMany({ where: { date: { gte: from, lte: to } }, select: { id: true, date: true, reason: true, receiptId: true, receipt: { select: { number: true, amount: true } } } }))
      add({ kind: "receipt_reversal", id: r.id, number: null, date: r.date, amount: r.receipt.amount.toFixed(2), originalId: r.receiptId, originalNumber: r.receipt.number, reason: r.reason ?? null, user: null });

    // Supplier payment reversals
    for (const r of await prisma.supplierPaymentReversal.findMany({ where: { date: { gte: from, lte: to } }, select: { id: true, date: true, reason: true, paymentId: true, payment: { select: { number: true, amount: true } } } }))
      add({ kind: "payment_reversal", id: r.id, number: null, date: r.date, amount: r.payment.amount.toFixed(2), originalId: r.paymentId, originalNumber: r.payment.number, reason: r.reason ?? null, user: null });

    // Journal reversals
    for (const r of await prisma.journalEntry.findMany({ where: { reversalOfId: { not: null }, date: { gte: from, lte: to } }, select: { id: true, number: true, date: true, description: true, reversalOfId: true, reversalOf: { select: { number: true } } } }))
      add({ kind: "journal_reversal", id: r.id, number: r.number, date: r.date, amount: "0.00", originalId: r.reversalOfId!, originalNumber: r.reversalOf?.number ?? null, reason: r.description, user: null });

    // Order cancellations (order amount computed from items — query items separately)
    const orderIds = (await prisma.order.findMany({ where: { status: "cancelled" }, select: { id: true, orderNumber: true, customerName: true, updatedAt: true } })).filter((o) => o.updatedAt.toISOString().slice(0, 10) >= from && o.updatedAt.toISOString().slice(0, 10) <= to);
    for (const o of orderIds)
      add({ kind: "order_cancelled", id: o.id, number: o.orderNumber, date: o.updatedAt.toISOString().slice(0, 10), amount: "0.00", originalId: null, originalNumber: null, reason: `إلغاء أمر ${o.customerName}`, user: null });

    // Supplier bill cancellations
    for (const b of await prisma.supplierBill.findMany({ where: { status: "cancelled", billDate: { gte: from, lte: to } }, select: { id: true, number: true, billDate: true, total: true, postedBy: true } }))
      add({ kind: "bill_cancelled", id: b.id, number: b.number, date: b.billDate, amount: b.total.toFixed(2), originalId: null, originalNumber: null, reason: null, user: b.postedBy });

    // Inventory document reversals
    for (const d of await prisma.inventoryDocument.findMany({ where: { reversalOfId: { not: null }, status: "reversed", businessDate: { gte: from, lte: to } }, select: { id: true, number: true, businessDate: true, type: true, reason: true, reversalOfId: true } }))
      add({ kind: `inv_${d.type}_reversed`, id: d.id, number: d.number, date: d.businessDate, amount: "0.00", originalId: d.reversalOfId!, originalNumber: null, reason: d.reason ?? null, user: null });

    rows.sort((a, b) => a.date.localeCompare(b.date));
    const totals = {
      creditNotes: rows.filter((r) => r.kind === "credit_note").reduce((s, r) => s + Number(r.amount), 0),
      debitNotes: rows.filter((r) => r.kind === "debit_note").reduce((s, r) => s + Number(r.amount), 0),
      reversals: rows.filter((r) => r.kind.endsWith("reversal")).length,
      billCancelled: rows.filter((r) => r.kind === "bill_cancelled").reduce((s, r) => s + Number(r.amount), 0),
    };

    return NextResponse.json({ from, to, count: rows.length, totals, entries: rows.slice(0, 500) });
  } catch (err) {
    return handleApiError(err);
  }
}