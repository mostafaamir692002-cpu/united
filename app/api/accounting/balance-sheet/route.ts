import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { balanceSheet } from "@/lib/accounting/ledger";
import { todayLocalISO } from "@/lib/localDate";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const sp = new URL(req.url).searchParams;
    const asOf = sp.get("as_of") ?? todayLocalISO();
    return NextResponse.json(await balanceSheet(asOf));
  } catch (err) {
    return handleApiError(err, req);
  }
}
