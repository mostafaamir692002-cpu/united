import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { listOrders, getOperationalIntelligence } from "@/lib/orders-service";

/**
 * Combines the order list the Command Center already needed with the
 * operational-intelligence classification, in one round trip.
 */
export async function GET(req: NextRequest) {
  try {
    await requireOrderActor(req, "reports.view");
    const orders = await listOrders({});
    const intelligence = await getOperationalIntelligence(orders);
    return NextResponse.json({ orders, intelligence });
  } catch (err) {
    return handleApiError(err);
  }
}
