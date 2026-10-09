import { NextRequest, NextResponse } from "next/server";
import { jsonFor } from "@/lib/security/redact";
import { handleApiError } from "@/lib/rbac";
import { requireStockActor } from "@/lib/stock-auth";
import { getIntake, updateIntake } from "@/lib/stock-service";
import { readJson } from "@/lib/http";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await requireStockActor(req, "stock.view");
    return jsonFor(viewer, { intake: await getIntake(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireStockActor(req, "stock.sort");
    const body = await readJson(req);
    const intake = await updateIntake(
      params.id,
      {
        received_kg: body.received_kg,
        rejected_kg: body.rejected_kg,
        crate_count: body.crate_count,
        notes: body.notes,
        received_date: body.received_date,
      },
      actor,
      body.reason,
      body.expected_version
    );
    return jsonFor(actor, { intake });
  } catch (err) {
    return handleApiError(err);
  }
}
