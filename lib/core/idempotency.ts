import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/rbac";
import { advisoryXactLock } from "@/lib/dbLock";
import type { Tx } from "@/lib/tx";

/**
 * One key per filled form (lib/clientKey.ts). A document that moves money is created at
 * most once per key: a double tap, a retry after a dropped connection, or a request
 * whose answer timed out returns the document the first attempt recorded — never a
 * second posting. The same key on a different document is refused.
 *
 *   inside the transaction:  await lockKey(tx, key)  → look the key up → replay(prev, same)
 */
export const idempotencyKeyField = z.string({ invalid_type_error: "مفتاح التكرار لازم يكون نص" }).min(8, "مفتاح التكرار قصير").max(120, "مفتاح التكرار طويل").optional();

/** Serialises every request carrying this key (a burst of identical submits waits for the first). */
export async function lockKey(tx: Tx, key: string | undefined | null) {
  if (key) await advisoryXactLock(tx, `idempotency:${key}`);
}

/** The first document for this key, if the request is the same one; otherwise 409. */
export function replay<T>(prev: T, same: boolean): T {
  if (!same) throw new ApiError(409, "مفتاح التكرار ده اتستخدم في عملية تانية");
  return prev;
}

/** Compare an exact request for new documents and retain a strict legacy comparison for old rows. */
export function replayRequest<T extends { requestHash?: string | null }>(prev: T, requestHash: string, legacySame: boolean): T {
  return replay(prev, prev.requestHash ? prev.requestHash === requestHash : legacySame);
}

/** Stable fingerprint for a validated request body used with an idempotency key. */
export function requestFingerprint(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object") {
      if (v instanceof Date) return v.toISOString();
      if ((v as { constructor?: { name?: string } }).constructor?.name === "Decimal" && typeof (v as { toString?: unknown }).toString === "function") {
        return (v as { toString(): string }).toString();
      }
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, item]) => [k, normalize(item)])
      );
    }
    return v;
  };
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}
