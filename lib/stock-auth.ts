import { NextRequest } from "next/server";
import { requirePermission, type AuthContext } from "@/lib/authz";
import type { Permission } from "@/lib/permissions";
import { serviceActorFromContext, type ServiceActor } from "@/lib/core/actor";

/** The stock module's actor is the general service actor; the name is kept for the
 * existing stock and product-master code that imports it. */
export type StockActor = ServiceActor;

export function stockActorFromContext(ctx: AuthContext): StockActor {
  return serviceActorFromContext(ctx);
}

/** Actor for a stock endpoint, gated on the permission that endpoint needs. */
export async function requireStockActor(
  req: NextRequest,
  permission: Permission | Permission[] = "stock.view"
): Promise<StockActor> {
  return stockActorFromContext(await requirePermission(req, permission));
}
