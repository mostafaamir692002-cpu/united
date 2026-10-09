import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { apAgingReport } from "@/lib/purchasing/bills";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "purchasing.bills.view");
    const asOf = new URL(req.url).searchParams.get("as_of") ?? undefined;
    return NextResponse.json({ aging: await apAgingReport(asOf) });
  } catch (err) {
    return handleApiError(err);
  }
}
