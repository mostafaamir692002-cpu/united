import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { getJournal } from "@/lib/accounting/ledger";

export async function GET(req: NextRequest, { params }: { params: Record<string, string> }) {
  try {
    await requirePermission(req, "accounting.view");
    return NextResponse.json({ journal: await getJournal(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}
