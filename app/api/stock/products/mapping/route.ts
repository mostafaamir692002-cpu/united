import { NextRequest, NextResponse } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { mapOrderProductName, unmapOrderProductName } from "@/lib/product-master-service";
import { readJson } from "@/lib/http";

/** Explicitly link an order product name to a canonical product. Audited. */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireStockActor(req, "stock.manage_products");
    const body = await readJson(req);
    const result = await mapOrderProductName(
      {
        product_name: body.product_name,
        unit: body.unit,
        product_id: body.product_id,
        create_alias: body.create_alias,
        reason: body.reason,
      },
      actor
    );
    return jsonFor(actor, result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Return an order product name to UNMAPPED. */
export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireStockActor(req, "stock.manage_products");
    const body = await readJson(req);
    return jsonFor(actor, 
      await unmapOrderProductName(
        { product_name: body.product_name, remove_alias: body.remove_alias, reason: body.reason },
        actor
      )
    );
  } catch (err) {
    return handleApiError(err);
  }
}
