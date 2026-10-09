import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { advisoryXactLock } from "@/lib/dbLock";
import { todayLocalISO } from "@/lib/localDate";

/** A Prisma client or an interactive-transaction client — both can run the queries below. */
type Db = Pick<Prisma.TransactionClient, "order" | "$queryRaw">;

/**
 * `dateStr` is always already a plain "YYYY-MM-DD" delivery date (validated at the
 * caller) — it is extracted here, never round-tripped through `new Date(dateStr)`.
 * That round trip parses a date-only string as UTC midnight and then reads back
 * LOCAL calendar components, which silently returns the PREVIOUS day on any host
 * whose local timezone sits west of UTC. Splitting the string avoids the timezone
 * entirely instead of depending on the host happening to be configured correctly.
 */
export function orderNumberPrefix(dateStr?: string) {
  if (dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (m) return `UN-${m[1]}${m[2]}${m[3]}-`;
  }
  return `UN-${todayLocalISO().replace(/-/g, "")}-`;
}

/**
 * Serialises order-number generation for one delivery day.
 *
 * The number is UN-YYYYMMDD-#### and has to be gapless-ish, sequential and unique.
 * Deriving it from a plain read (count/max) and then inserting is a read-modify-write
 * race: on SQLite that was hidden because writes were effectively serialised, but on
 * Postgres several concurrent creates genuinely read the same value and all but one
 * lose the unique index — the caller then burned its retries re-reading the same stale
 * value and surfaced a 500. A transaction-scoped advisory lock keyed on the day's
 * prefix makes read+insert atomic for that day, while leaving creates for other days
 * (and every other write in the system) completely unblocked. The lock is released
 * automatically when the surrounding transaction commits or rolls back, so it is safe
 * through the PgBouncer transaction pooler.
 */
export async function lockOrderNumberDay(tx: Db, prefix: string) {
  await advisoryXactLock(tx, `order-number:${prefix}`);
}

/**
 * Next sequential number for the day. Uses MAX(suffix)+1 rather than COUNT(*)+1 so a
 * cancelled/removed row (or any historic gap) can't make the generator hand out a
 * number that already exists. Must be called with the day's advisory lock held.
 */
export async function nextOrderNumber(tx: Db, prefix: string) {
  const suffixStart = prefix.length + 1; // Postgres SUBSTRING is 1-indexed
  const rows = await tx.$queryRaw<{ max_seq: number | null }[]>`
    SELECT MAX(SUBSTRING("orderNumber" FROM ${suffixStart}::int)::int) AS max_seq
    FROM "Order"
    WHERE "orderNumber" LIKE ${prefix + "%"}
      AND SUBSTRING("orderNumber" FROM ${suffixStart}::int) ~ '^[0-9]+$'
  `;
  const next = Number(rows[0]?.max_seq ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** Convenience wrapper for callers outside a transaction (kept for API compatibility). */
export async function generateOrderNumber(dateStr?: string) {
  const prefix = orderNumberPrefix(dateStr);
  return prisma.$transaction(async (tx) => {
    await lockOrderNumberDay(tx, prefix);
    return nextOrderNumber(tx, prefix);
  });
}
