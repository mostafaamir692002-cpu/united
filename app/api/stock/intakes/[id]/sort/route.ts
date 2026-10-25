import { NextRequest } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { createSorting } from "@/lib/inventory/documents";
import { readJson } from "@/lib/http";

/**
 * POST /api/stock/intakes/[id]/sort
 * Sorts an existing raw intake into good-grade / Grade B / waste.
 * Body: { input_kg, good_kg, grade_b_kg, waste_kg, grade_b_product_id?, reason, business_date?, idempotency_key? }
 * Outputs must reconcile exactly with input_kg (3-dp).
 */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const actor = await requireStockActor(req, "stock.adjust");
    const body = await readJson(req);
    const { document, replayed } = await createSorting(
      {
        intake_id: ctx.params.id,
        input_kg: body.input_kg,
        good_kg: body.good_kg,
        grade_b_kg: body.grade_b_kg,
        waste_kg: body.waste_kg,
        grade_b_product_id: body.grade_b_product_id,
        reason: body.reason,
        business_date: body.business_date,
        idempotency_key: body.idempotency_key,
      },
      actor
    );
    return jsonFor(actor, { document }, { status: replayed ? 200 : 201 });
  } catch (err) {
    return handleApiError(err, req);
  }
}