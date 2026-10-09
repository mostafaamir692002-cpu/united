import { NextRequest, NextResponse } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { removeAlias } from "@/lib/product-master-service";

export async function DELETE(req: NextRequest, { params }: { params: { aliasId: string } }) {
  try {
    const actor = await requireStockActor(req, "stock.manage_products");
    return jsonFor(actor, await removeAlias(params.aliasId, actor));
  } catch (err) {
    return handleApiError(err);
  }
}
