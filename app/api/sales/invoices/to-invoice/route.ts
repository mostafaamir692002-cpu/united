import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { ordersToInvoice } from "@/lib/sales/invoicing";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.invoices.view");
    return NextResponse.json({ orders: await ordersToInvoice() });
  } catch (err) {
    return handleApiError(err);
  }
}
