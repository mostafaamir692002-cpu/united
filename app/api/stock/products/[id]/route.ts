import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { updateProduct } from "@/lib/product-master-service";
import { readJson } from "@/lib/http";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireStockActor(req, "stock.manage_products");
    const body = await readJson(req);
    const product = await updateProduct(
      params.id,
      {
        name: body.name,
        name_ar: body.name_ar,
        sku: body.sku,
        category: body.category,
        unit: body.unit,
        stock_tracked: body.stock_tracked,
        active: body.active,
      },
      actor,
      body.expected_version
    );
    return jsonFor(actor, { product });
  } catch (err) {
    return handleApiError(err);
  }
}
