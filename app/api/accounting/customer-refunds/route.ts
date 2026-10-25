import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/rbac";
import { requirePermission } from "@/lib/authz";
import { createCustomerRefund, listCustomerRefunds } from "@/lib/accounting/cash";
import { postHandler } from "@/lib/route-handlers";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "accounting.view");
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ refunds: await listCustomerRefunds({ customerId: sp.get("customer_id") ?? undefined }) });
  } catch (err) {
    return handleApiError(err, req);
  }
}

/** Money out to a customer from the credit they hold: paid by whoever pays money out. */
export const POST = postHandler(
  "accounting.payments.manage",
  async (body, actor) => createCustomerRefund(body, actor),
  (r) => ((r as { replayed?: boolean }).replayed ? 200 : 201)
);
