import { NextRequest, NextResponse } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { createAdjustment } from "@/lib/stock-service";
import { readJson } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireStockActor(req, "stock.adjust");
    const body = await readJson(req);
    const result = await createAdjustment(
      {
        product_id: body.product_id,
        quantity_kg: body.quantity_kg ?? body.quantity,
        effective_date: body.effective_date,
        reason: body.reason,
        idempotency_key: body.idempotency_key,
      },
      actor
    );
    // 202: accepted, but nothing has moved yet — it waits for approval.
    return jsonFor(actor, result, { status: result.pendingApproval ? 202 : 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
