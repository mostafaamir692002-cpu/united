import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { profitLoss, balanceSheet } from "@/lib/accounting/ledger";
import { todayLocalISO } from "@/lib/localDate";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const sp = new URL(req.url).searchParams;
    const from = sp.get("from") ?? `${todayLocalISO().slice(0, 4)}-01-01`;
    const to = sp.get("to") ?? todayLocalISO();
    return NextResponse.json(await profitLoss(from, to));
  } catch (err) {
    return handleApiError(err);
  }
}
