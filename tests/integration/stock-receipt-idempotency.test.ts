/* Stock receipts are posted once per client key. A sequential repeat, a burst of
   concurrent identical requests, and a retry after a timeout all return the first
   receipt — one receipt, one stock movement, one GRNI posting. Different keys are
   different deliveries. Without a key, receiving behaves exactly as before. */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma, actor } from "./_db";
import { recordIntake } from "@/lib/stock-service";

const TAG = `ZZRCVKEY${Date.now()}`;
const who = actor("أمين المخزن", ["stock.receive", "stock.view", "stock.valuation.view"]);
let supplierId = "";
let productId = "";

before(async () => {
  supplierId = (await prisma.supplier.create({ data: { code: `SUP-7${String(Date.now()).slice(-7)}`, name: `${TAG} Farm` } })).id;
  productId = (await prisma.stockProduct.create({ data: { name: `${TAG} Tomato` } })).id;
});
after(() => prisma.$disconnect());

const body = (key: string | undefined, kg = 50) => ({ supplier_id: supplierId, product_id: productId, received_kg: kg, rejected_kg: 2, unit_cost: "6", location_id: "loc_cold_1", idempotency_key: key });
const onHand = async () => Number((await prisma.stockMovement.aggregate({ where: { productId }, _sum: { quantity: true } }))._sum.quantity ?? 0);
const grni = async () => {
  const r = await prisma.journalLine.aggregate({ where: { account: { systemKey: "grni" }, entry: { valuationPostings: { some: { movement: { productId } } } } }, _sum: { debit: true, credit: true } });
  return Number(r._sum.credit ?? 0) - Number(r._sum.debit ?? 0);
};
const postedFor = async (intakeId: string) => ({
  movements: await prisma.stockMovement.count({ where: { intakeId } }),
  entries: await prisma.stockValuationPosting.count({ where: { movement: { intakeId }, entryId: { not: null } } }),
});

test("sequential duplicate: the second request returns the first receipt and posts nothing", async () => {
  const [s0, g0] = [await onHand(), await grni()];
  const a = await recordIntake(body(`${TAG}-seq`), who);
  const b = await recordIntake(body(`${TAG}-seq`), who);
  assert.equal(a.replayed, false);
  assert.equal(b.replayed, true);
  assert.equal(b.intake.id, a.intake.id);
  assert.equal(b.intake.receiptNumber, a.intake.receiptNumber);
  assert.equal((await onHand()) - s0, 48);
  assert.equal((await grni()) - g0, 48 * 6);
  assert.deepEqual(await postedFor(a.intake.id), { movements: 1, entries: 1 });
});

test("concurrent duplicate: five identical requests at once → exactly one receipt and one stock posting", async () => {
  const [s0, g0] = [await onHand(), await grni()];
  const all = await Promise.all([1, 2, 3, 4, 5].map(() => recordIntake(body(`${TAG}-burst`), who)));
  assert.equal(new Set(all.map((x) => x.intake.id)).size, 1);
  assert.equal(all.filter((x) => !x.replayed).length, 1);
  assert.equal(await prisma.stockIntake.count({ where: { idempotencyKey: `${TAG}-burst` } }), 1);
  assert.equal((await onHand()) - s0, 48);
  assert.equal((await grni()) - g0, 48 * 6, "no duplicate GRNI / accounting entry");
  assert.deepEqual(await postedFor(all[0].intake.id), { movements: 1, entries: 1 });
});

test("retry after a timeout: the response was lost, the retry returns the receipt the server already recorded", async () => {
  const s0 = await onHand();
  // The first attempt commits, but the client never sees the answer (timeout).
  const lost = recordIntake(body(`${TAG}-timeout`), who);
  const committed = await lost;
  // The client retries the same form with the same key.
  const retry = await recordIntake(body(`${TAG}-timeout`), who);
  assert.equal(retry.replayed, true);
  assert.equal(retry.intake.id, committed.intake.id);
  assert.equal((await onHand()) - s0, 48);
});

test("different keys are different deliveries: two legitimate receipts", async () => {
  const s0 = await onHand();
  const a = await recordIntake(body(`${TAG}-truck-1`), who);
  const b = await recordIntake(body(`${TAG}-truck-2`), who);
  assert.notEqual(a.intake.id, b.intake.id);
  assert.equal(a.replayed || b.replayed, false);
  assert.equal((await onHand()) - s0, 96);
});

test("the same key on a different receipt is refused (409), nothing posted", async () => {
  await recordIntake(body(`${TAG}-reuse`), who);
  const s0 = await onHand();
  await assert.rejects(recordIntake(body(`${TAG}-reuse`, 60), who), (e: any) => e.status === 409);
  assert.equal(await onHand(), s0);
});

test("without a key, receiving behaves as before (each request is a receipt)", async () => {
  const s0 = await onHand();
  const a = await recordIntake(body(undefined), who);
  const b = await recordIntake(body(undefined), who);
  assert.notEqual(a.intake.id, b.intake.id);
  assert.equal((await onHand()) - s0, 96);
});

test("an invalid key is refused before anything is recorded", async () => {
  await assert.rejects(recordIntake({ ...body(undefined), idempotency_key: 42 as unknown as string }, who), (e: any) => e.status === 400);
});
