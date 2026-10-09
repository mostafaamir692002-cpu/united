import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { financeReport } from "@/lib/management/reports";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "reports.finance");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ report: await financeReport({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined }) });
  } catch (err) {
    return handleApiError(err);
  }
}
