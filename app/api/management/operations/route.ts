import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { operationsReport } from "@/lib/management/reports";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "reports.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ report: await operationsReport({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined }) });
  } catch (err) {
    return handleApiError(err, req);
  }
}
