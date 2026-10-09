/* Document numbering under real concurrency, against PostgreSQL. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, inTx } from "./_db";
import { nextDocumentNumber, formatDocumentNumber, periodOf, SEQUENCE_DEFS } from "@/lib/core/sequences";

const DAY = "2031-03-15"; // a year no fixture uses, so counters start clean

after(async () => {
  await prisma.$executeRaw`DELETE FROM "NumberSequenceCounter" WHERE "period" LIKE '2031%'`;
  await prisma.$disconnect();
});

test("50 concurrent allocations: all distinct and contiguous", async () => {
  await prisma.$executeRaw`DELETE FROM "NumberSequenceCounter" WHERE "period" LIKE '2031%'`;
  const numbers = await Promise.all(
    Array.from({ length: 50 }, () => inTx((tx) => nextDocumentNumber(tx, "inventory.transfer", DAY)))
  );
  assert.equal(new Set(numbers).size, 50, "no duplicates");
  const runs = numbers.map((n) => Number(n.split("-").pop())).sort((a, b) => a - b);
  assert.deepEqual(runs, Array.from({ length: 50 }, (_, i) => i + 1), "1..50 with no gaps");
  assert.match(numbers[0], /^TRF-2031-\d{5}$/);
});

test("a rolled-back document does not burn its number", async () => {
  const before = await inTx((tx) => nextDocumentNumber(tx, "inventory.adjustment", DAY));
  await assert.rejects(
    inTx(async (tx) => {
      await nextDocumentNumber(tx, "inventory.adjustment", DAY);
      throw new Error("save failed");
    })
  );
  const after = await inTx((tx) => nextDocumentNumber(tx, "inventory.adjustment", DAY));
  assert.equal(Number(after.split("-").pop()), Number(before.split("-").pop()) + 1);
});

test("periods reset independently", async () => {
  const a = await inTx((tx) => nextDocumentNumber(tx, "inventory.lot", "2031-03-15"));
  const b = await inTx((tx) => nextDocumentNumber(tx, "inventory.lot", "2031-03-16"));
  assert.equal(a, "LOT-20310315-0001");
  assert.equal(b, "LOT-20310316-0001");
});

test("formatting", () => {
  assert.equal(periodOf("monthly", "2026-10-08"), "202610");
  assert.equal(periodOf("never", "2026-10-08"), "all");
  assert.equal(formatDocumentNumber({ ...SEQUENCE_DEFS["core.approval"], reset: "never" }, "all", 7), "APR-00007");
});
