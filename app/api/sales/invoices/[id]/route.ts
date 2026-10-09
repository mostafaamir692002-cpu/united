import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { getInvoice } from "@/lib/sales/invoicing";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(req, "sales.invoices.view");
    return NextResponse.json({ invoice: await getInvoice(params.id) });
  } catch (err) {
    return handleApiError(err);
  }
}
