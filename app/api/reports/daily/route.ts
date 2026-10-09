import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requireOrderActor } from "@/lib/api-auth";
import { dailyOperationsSummary } from "@/lib/orders-service";

export async function GET(req: NextRequest) {
  try {
    await requireOrderActor(req, "reports.view");
    return NextResponse.json(await dailyOperationsSummary());
  } catch (err) {
    return handleApiError(err);
  }
}
