import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { listPeriods } from "@/lib/accounting/ledger";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ periods: await listPeriods() });
  } catch (err) {
    return handleApiError(err, req);
  }
}
