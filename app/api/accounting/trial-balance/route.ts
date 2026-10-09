import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { trialBalance } from "@/lib/accounting/ledger";
import { todayLocalISO } from "@/lib/localDate";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ trialBalance: await trialBalance(sp.get("from") ?? `${todayLocalISO().slice(0, 4)}-01-01`, sp.get("to") ?? todayLocalISO()) });
  } catch (err) {
    return handleApiError(err);
  }
}
