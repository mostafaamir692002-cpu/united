import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Tx = Prisma.TransactionClient;

/**
 * One business action, one transaction: the state change, its ledger rows and its
 * audit rows commit together or not at all.
 *
 * The limits are wider than Prisma's 2s/5s defaults because writers that take an
 * advisory lock (order numbers, receipts, stock balance checks) legitimately queue
 * behind each other under load; giving up after 2s would turn a short queue into a
 * failed request on a busy morning.
 */
export function inTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const result = await fn(tx);
      // Deferred constraints (journal balance, allocation caps) are checked at COMMIT —
      // and Prisma resolves an interactive transaction whose COMMIT fails as if it had
      // succeeded (the data is rolled back, the caller is told nothing). Running them
      // here, still inside the transaction, turns a violation into a thrown error.
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return result;
    },
    { maxWait: 15_000, timeout: 20_000 }
  );
}
