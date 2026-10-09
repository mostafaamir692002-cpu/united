import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { createInvoiceFromOrder, listInvoices } from "@/lib/sales/invoicing";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "sales.invoices.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ invoices: await listInvoices({ status: sp.get("status") ?? undefined, customerId: sp.get("customer_id") ?? undefined, orderId: sp.get("order_id") ?? undefined }) });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Draft an invoice for a dispatched order (idempotent: the order's live invoice
 * comes back with 200 if one exists). */
export const POST = postHandler(
  "sales.invoices.manage",
  (body, actor) => {
    if (typeof body.order_id !== "string" || !body.order_id) throw new ApiError(400, "حدد الأوردر");
    return createInvoiceFromOrder(body.order_id, actor);
  },
  (r) => ((r as { created?: boolean }).created ? 201 : 200)
);
