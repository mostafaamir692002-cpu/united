import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { addAlias } from "@/lib/product-master-service";
import { readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireStockActor(req, "stock.manage_products");
    const body = await readJson(req);
    const alias = await addAlias(params.id, body.alias, actor);
    return jsonFor(actor, { alias }, { status: 201 });
  } catch (err) {
    return handleApiError(err, req);
  }
}
