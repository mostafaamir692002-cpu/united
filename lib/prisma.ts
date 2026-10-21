import { PrismaClient } from "@prisma/client";
// Importing for the side effect: this is the module every server path reaches
// through, so environment validation runs before the first query is attempted.
import "@/lib/env";

// StockMovement.seq is a BIGINT (the ledger's total order). JSON.stringify throws on a
// bigint, so any route returning a raw movement row would 500. Serialise as a string:
// exact at any size, and the client never does arithmetic on it.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
if (!("toJSON" in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, "toJSON", {
    value: function (this: bigint) {
      return this.toString();
    },
    writable: true,
    configurable: true,
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Set PRISMA_LOG_QUERIES=1 to emit every query as an event. Off by default; it exists
 * because the thing that actually makes this app feel slow is the NUMBER of network
 * round trips per request, and that is invisible without being able to count them.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    process.env.PRISMA_LOG_QUERIES ? { log: [{ emit: "event", level: "query" }] } : undefined
  );

// Global singleton — same PrismaClient for the whole life of the server.
// Without this, every route creates a new connection pool and the Supavisor
// session pooler (connection_limit=1) would exhaust connections under load.
globalForPrisma.prisma = prisma;
