/** Integration tests call services directly against the (guarded) test database. */
import { assertTestDatabase } from "../_guard";

assertTestDatabase();

export { prisma } from "@/lib/prisma";
export { inTx } from "@/lib/tx";

/** A fake actor with exactly the permissions a test needs. */
export function actor(name: string, permissions: string[], id: string | null = null, role = "SUPERVISOR") {
  return { id, name, role: role as any, permissions, source: "user" as const };
}
