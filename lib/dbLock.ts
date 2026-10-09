import type { Prisma } from "@prisma/client";

/** Anything that can run a raw query — the Prisma client or a transaction client. */
export type LockableTx = Pick<Prisma.TransactionClient, "$queryRaw">;

/**
 * Take a Postgres transaction-scoped advisory lock on an arbitrary string key.
 *
 * Used to make read-then-insert sequences atomic (next order number, external_id
 * de-duplication) without adding table locks or new unique constraints. The lock is
 * released automatically when the surrounding transaction commits or rolls back, so
 * it is safe through the PgBouncer transaction pooler — unlike a session-level lock,
 * which could outlive the checkout and leak onto another request's connection.
 *
 * Callers that need more than one lock in the same transaction must always take them
 * in the same order (external_id before order-number day) so two concurrent creates
 * can never deadlock against each other.
 */
export async function advisoryXactLock(tx: LockableTx, key: string) {
  // pg_advisory_xact_lock() returns void, which $queryRaw cannot deserialize —
  // the IS NULL test turns it into a plain boolean column.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key})) IS NULL AS locked`;
}
