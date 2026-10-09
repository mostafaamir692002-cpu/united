import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { createException, listExceptions } from "@/lib/operations/exceptions";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "orders.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ exceptions: await listExceptions({ status: sp.get("status") ?? undefined, type: sp.get("type") ?? undefined, orderId: sp.get("order_id") ?? undefined, tripId: sp.get("trip_id") ?? undefined }) });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Reporting needs a hand on the order (prepare / load / dispatch / approve) — checked in the service. */
export const POST = postHandler("orders.view", async (body, actor) => ({ exception: await createException(body, actor) }));
