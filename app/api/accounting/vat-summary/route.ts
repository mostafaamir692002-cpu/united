import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { vatSummary } from "@/lib/accounting/vat-summary";
import { todayLocalISO } from "@/lib/localDate";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const params = new URL(req.url).searchParams;
    const today = todayLocalISO();
    return NextResponse.json({ summary: await vatSummary(params.get("from") ?? `${today.slice(0, 4)}-01-01`, params.get("to") ?? today) });
  } catch (err) {
    return handleApiError(err, req);
  }
}
