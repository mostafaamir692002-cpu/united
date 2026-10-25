import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listFleet } from "@/lib/operations/trips";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "orders.view");
    return NextResponse.json(await listFleet());
  } catch (err) {
    return handleApiError(err, req);
  }
}
