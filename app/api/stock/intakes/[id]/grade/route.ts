import { NextRequest, NextResponse } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { gradeIntake } from "@/lib/inventory/grading";
import { readJson } from "@/lib/http";

/**
 * POST /api/stock/intakes/:id/grade
 *
 * Perform deferred grading on a raw intake: assign quantities from
 * the received stock to good (Grade A), Grade B (فرزة), and waste (هالك).
 *
 * Body: { good_kg, grade_b_kg?, waste_kg?, good_location_id?, grade_b_location_id?, waste_location_id?, notes? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await requireStockActor(req, "stock.sort");
    const body = await readJson(req);

    const result = await gradeIntake(
      {
        intake_id: params.id,
        good_kg: body.good_kg,
        grade_b_kg: body.grade_b_kg,
        waste_kg: body.waste_kg,
        good_location_id: body.good_location_id,
        grade_b_location_id: body.grade_b_location_id,
        waste_location_id: body.waste_location_id,
        notes: body.notes,
      },
      actor
    );

    return jsonFor(actor, { grading: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}