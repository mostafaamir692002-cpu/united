import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { billableReceipts } from "@/lib/purchasing/bills";

/** Receipts of the supplier not yet on a bill, with their agreed price. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "purchasing.bills.view");
    return NextResponse.json({ receipts: await billableReceipts(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}
