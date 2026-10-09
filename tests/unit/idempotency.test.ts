import { test } from "node:test";
import assert from "node:assert/strict";
import { replayRequest, requestFingerprint } from "@/lib/core/idempotency";
import { Prisma } from "@prisma/client";

test("request fingerprint ignores object key order but preserves array line order", () => {
  assert.equal(
    requestFingerprint({ a: 1, lines: [{ product: "x", qty: "2" }] }),
    requestFingerprint({ lines: [{ qty: "2", product: "x" }], a: 1 })
  );
  assert.notEqual(
    requestFingerprint({ lines: [{ product: "x" }, { product: "y" }] }),
    requestFingerprint({ lines: [{ product: "y" }, { product: "x" }] })
  );
});

test("request fingerprint changes when a retry changes its payload", () => {
  assert.notEqual(requestFingerprint({ qty: "2" }), requestFingerprint({ qty: "3" }));
});

test("request fingerprints canonicalize Decimal amounts and include all document fields", () => {
  assert.equal(requestFingerprint({ amount: new Prisma.Decimal("1.00") }), requestFingerprint({ amount: new Prisma.Decimal("1") }));
  assert.notEqual(requestFingerprint({ amount: new Prisma.Decimal("1"), dueDate: "2026-10-09" }), requestFingerprint({ amount: new Prisma.Decimal("1"), dueDate: "2026-10-10" }));
});

test("stored request fingerprints reject a reused key with a changed payload", () => {
  const original = { id: "doc", requestHash: requestFingerprint({ amount: "10.00", description: "first" }) };
  assert.equal(replayRequest(original, original.requestHash, true), original);
  assert.throws(() => replayRequest(original, requestFingerprint({ amount: "10.00", description: "changed" }), true), /مفتاح التكرار/);
});
