import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { plannableOrders } from "@/lib/operations/trips";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "operations.trips.manage");
    return NextResponse.json({ orders: await plannableOrders(new URL(req.url).searchParams.get("date") ?? undefined) });
  } catch (err) {
    return handleApiError(err);
  }
}
