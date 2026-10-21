import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { productStockDetail } from "@/lib/inventory/products";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requirePermission(req, "stock.view");
    return jsonFor(ctx, 
      await productStockDetail(params.id, new URL(req.url).searchParams.get("warehouse_id") ?? undefined, { withValue: ctx.can("stock.valuation.view") })
    );
  } catch (err) {
    return handleApiError(err);
  }
}
