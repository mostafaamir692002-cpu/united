import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { accountLedger } from "@/lib/accounting/ledger";
import { todayLocalISO } from "@/lib/localDate";

export async function GET(req: NextRequest, { params }: { params: Record<string, string> }) {
  try {
    await requirePermission(req, "accounting.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ ledger: await accountLedger(params.id, sp.get("from") ?? `${todayLocalISO().slice(0, 4)}-01-01`, sp.get("to") ?? todayLocalISO(), { limit: Number(sp.get("limit")) || undefined, offset: Number(sp.get("offset")) || undefined }) });
  } catch (err) {
    return handleApiError(err);
  }
}
