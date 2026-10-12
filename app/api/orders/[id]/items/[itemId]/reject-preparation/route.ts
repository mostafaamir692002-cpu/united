import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { rejectPreparation } from "@/lib/orders-service";
import { readJson } from "@/lib/http";

/**
 * POST /api/orders/:id/items/:itemId/reject-preparation
 *
 * Supervisor rejects the preparation of an item and sets the correct quantity.
 * Resets preparationStatus to "pending" so the preparer can re-prepare.
 *
 * Body: { correct_quantity: number, reason: string, expected_version?: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const actor = await requireOrderActor(req, "orders.approve");
    const body = await readJson(req);

    const item = await rejectPreparation(params.id, params.itemId, actor, {
      correctQuantity: body.correct_quantity,
      reason: body.reason,
      expectedVersion: body.expected_version,
    });

    return NextResponse.json({ item });
  } catch (err) {
    return handleApiError(err);
  }
}