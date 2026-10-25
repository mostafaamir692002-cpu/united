import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireAnyPermission } from "@/lib/authz";
import { serviceActorFromContext } from "@/lib/core/actor";
import { jsonFor } from "@/lib/security/redact";
import { readJson } from "@/lib/http";
import { updateInventorySettings } from "@/lib/inventory/products";

/** Handling settings belong to stock (stock.manage_products); costing — standard cost and
 * costing method — to finance (accounting.manage). The service checks each field. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = serviceActorFromContext(await requireAnyPermission(req, ["stock.manage_products", "accounting.manage"]));
    const product = await updateInventorySettings(params.id, await readJson(req), actor);
    return jsonFor(actor, { product }, { status: 200 });
  } catch (err) {
    return handleApiError(err, req);
  }
}
