import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { orderProductCoverage } from "@/lib/product-master-service";

/** How much of what orders actually name is understood by the Product Master. */
export async function GET(req: NextRequest) {
  try {
    const viewer = await requireStockActor(req, "stock.view");
    return jsonFor(viewer, await orderProductCoverage());
  } catch (err) {
    return handleApiError(err, req);
  }
}
