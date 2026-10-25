import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { assignOrder } from "@/lib/orders-service";
import { readJson } from "@/lib/http";

/** A supervisor assigns who prepares the order (user_id null clears it). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireOrderActor(req, "orders.approve");
    const body = await readJson(req);
    const order = await assignOrder(params.id, typeof body.user_id === "string" ? body.user_id : null, actor);
    return NextResponse.json({ order });
  } catch (err) {
    return handleApiError(err, req);
  }
}
