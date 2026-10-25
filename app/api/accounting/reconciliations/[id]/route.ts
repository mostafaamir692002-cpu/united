import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { getReconciliation } from "@/lib/accounting/cash";

export async function GET(req: NextRequest, { params }: { params: Record<string, string> }) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ reconciliation: await getReconciliation(params.id) });
  } catch (err) {
    return handleApiError(err, req);
  }
}
