import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { editRequiredQuantity } from "@/lib/orders-service";
import { readJson } from "@/lib/http";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const actor = await requireOrderActor(req, "orders.edit");
    const body = await readJson(req);
    const item = await editRequiredQuantity(
      params.id,
      params.itemId,
      body.quantity,
      actor,
      body.reason,
      body.expected_version
    );
    return NextResponse.json({ item });
  } catch (err) {
    return handleApiError(err, req);
  }
}
