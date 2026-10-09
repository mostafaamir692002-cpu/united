/* Supplier bills against PostgreSQL: the database keeps posted bills and debit notes
   immutable, a receipt can sit on only one live bill even under concurrency, debit
   notes never exceed what was billed, and a billed receipt can no longer change. */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma, actor } from "./_db";
import { createIntake, updateIntake, voidIntake } from "@/lib/stock-service";
import { cancelBill, createBill, createDebitNote, postBill } from "@/lib/purchasing/bills";
import { todayLocalISO } from "@/lib/localDate";

const TAG = `ZZAPL${Date.now()}`;
const boss = actor("أمين مخزن", ["stock.receive", "stock.sort", "stock.view", "stock.valuation.view"]);
const acct = actor("محاسب", ["purchasing.bills.manage", "purchasing.bills.view"]);
const today = todayLocalISO();
let supplierId = "";
let productId = "";
const receipt = async (kg: number) => (await createIntake({ supplier_id: supplierId, product_id: productId, received_kg: kg, received_date: today, unit_cost: "10" } as never, boss)).id;

before(async () => {
  supplierId = (await prisma.supplier.create({ data: { code: `SUP-8${String(Date.now()).slice(-7)}`, name: `${TAG} مورد`, paymentTermsDays: 7 } })).id;
  productId = (await prisma.stockProduct.create({ data: { name: `${TAG} Pepper`, unit: "KG" } })).id;
});
after(() => prisma.$disconnect());

test("two bills racing for one receipt: exactly one gets it", async () => {
  const r = await receipt(10);
  const results = await Promise.all(
    [1, 2, 3].map((i) => createBill({ supplier_id: supplierId, supplier_invoice_no: `${TAG}-R${i}`, bill_date: today, lines: [{ intake_id: r, unit_price: "10" }] }, acct).then(() => "ok", (e) => e.status ?? e.message))
  );
  assert.deepEqual(results.filter((x) => x === "ok").length, 1, JSON.stringify(results));
  assert.ok(results.filter((x) => x !== "ok").every((x) => x === 409), JSON.stringify(results));
  assert.equal(await prisma.supplierBillLine.count({ where: { intakeId: r, released: false } }), 1);
});

test("the same supplier invoice number cannot be booked twice, even concurrently", async () => {
  const [a, b] = [await receipt(5), await receipt(6)];
  const results = await Promise.all(
    [a, b].map((r, i) => createBill({ supplier_id: supplierId, supplier_invoice_no: i ? ` ${TAG}-dup ` : `${TAG}-DUP`, bill_date: today, lines: [{ intake_id: r, unit_price: "10" }] }, acct).then(() => "ok", (e) => e.status))
  );
  assert.deepEqual(results.sort(), [409, "ok"].sort(), JSON.stringify(results));
});

test("a posted bill and its lines cannot be changed or deleted, even with raw SQL", async () => {
  const r = await receipt(20);
  const bill = await createBill({ supplier_id: supplierId, supplier_invoice_no: `${TAG}-P`, bill_date: today, lines: [{ intake_id: r, unit_price: "10" }] }, acct);
  assert.equal(bill.dueDate > today || bill.dueDate === today, true);
  const posted = await postBill(bill.id, acct);
  assert.equal(posted.status, "posted");
  assert.equal(posted.total.toString(), "200");
  await assert.rejects(prisma.$executeRaw`UPDATE "SupplierBill" SET "notes" = 'x' WHERE "id" = ${bill.id}`, /cannot change/);
  await assert.rejects(prisma.$executeRaw`DELETE FROM "SupplierBill" WHERE "id" = ${bill.id}`, /never deleted/);
  await assert.rejects(prisma.$executeRaw`UPDATE "SupplierBillLine" SET "unitPrice" = 1 WHERE "billId" = ${bill.id}`, /cannot change/);
  await assert.rejects(prisma.$executeRaw`UPDATE "SupplierBillLine" SET "released" = true WHERE "billId" = ${bill.id}`, /cannot change/);
  await assert.rejects(cancelBill(bill.id, { reason: "x" }, acct), /إشعار مدين/);
  // …and its receipt is frozen with it.
  const intake = await prisma.stockIntake.findUniqueOrThrow({ where: { id: r } });
  await assert.rejects(updateIntake(r, { received_kg: 15 } as never, boss, "تصحيح", intake.version), /عليه فاتورة/);
  await assert.rejects(voidIntake(r, boss, "غلط", intake.version), /عليه فاتورة/);
  // A notes-only edit is not a change to what was billed.
  await updateIntake(r, { notes: "ملاحظة" } as never, boss, "ملاحظة", intake.version);
});

test("concurrent debit notes never debit more than was billed; they are append-only", async () => {
  const r = await receipt(10);
  const bill = await postBill((await createBill({ supplier_id: supplierId, supplier_invoice_no: `${TAG}-D`, bill_date: today, lines: [{ intake_id: r, unit_price: "10" }] }, acct)).id, acct);
  const lineId = (await prisma.supplierBillLine.findFirstOrThrow({ where: { billId: bill.id } })).id;
  const results = await Promise.all(
    Array.from({ length: 5 }, () => createDebitNote(bill.id, { reason: "مرتجع", lines: [{ bill_line_id: lineId, quantity: 3 }] }, acct).then(() => "ok", () => "refused"))
  );
  assert.equal(results.filter((x) => x === "ok").length, 3, "3 × 3 kg fit in 10 kg");
  const sum = await prisma.debitNoteLine.aggregate({ where: { billLineId: lineId }, _sum: { quantity: true, total: true } });
  assert.equal(sum._sum.quantity?.toString(), "9");
  assert.equal(sum._sum.total?.toString(), "90");
  const dn = await prisma.debitNote.findFirstOrThrow({ where: { billId: bill.id } });
  await assert.rejects(prisma.$executeRaw`UPDATE "DebitNote" SET "total" = 1 WHERE "id" = ${dn.id}`, /append-only/);
  await assert.rejects(prisma.$executeRaw`DELETE FROM "DebitNoteLine" WHERE "debitNoteId" = ${dn.id}`, /append-only/);
});

test("cancelling a draft releases its receipts for another bill", async () => {
  const r = await receipt(4);
  const bill = await createBill({ supplier_id: supplierId, supplier_invoice_no: `${TAG}-C`, bill_date: today, lines: [{ intake_id: r, unit_price: "10" }] }, acct);
  await cancelBill(bill.id, { reason: "رقم غلط" }, acct);
  const again = await createBill({ supplier_id: supplierId, supplier_invoice_no: `${TAG}-C`, bill_date: today, lines: [{ intake_id: r, unit_price: "10" }] }, acct);
  assert.equal(again.status, "draft", "same invoice number is free again after cancelling");
});

test("totals that do not add up are refused by the database", async () => {
  await assert.rejects(
    prisma.supplierBill.create({ data: { number: `BILL-2026-9${String(Date.now()).slice(-6)}`, supplierId, supplierInvoiceNo: "x", billDate: today, dueDate: today, gross: 10, net: 10, taxTotal: 1, total: 10, createdBy: "x" } }),
    /SupplierBill_totals/
  );
});
